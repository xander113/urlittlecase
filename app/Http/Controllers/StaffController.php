<?php

namespace App\Http\Controllers;

use App\Models\Ban;
use App\Models\Item;
use App\Models\Report;
use App\Models\StaffAction;
use App\Models\User;
use App\Models\UserItem;
use App\Services\EconomyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StaffController extends Controller
{
    public function __construct(private EconomyService $economy) {}

    public function index(Request $request): Response
    {
        $this->requireStaff($request);

        $stats = [
            'open_reports'   => Report::where('status', 'open')->count(),
            'active_bans'    => Ban::active()->count(),
            'pending_items'  => Item::where('is_approved', false)->count(),
            'total_users'    => User::count(),
        ];

        $recentActions = StaffAction::with('staff:id,name')
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return Inertia::render('Staff/Index', [
            'stats'         => $stats,
            'recentActions' => $recentActions,
        ]);
    }

    // ─── Reports ──────────────────────────────────────────────────────────────

    public function reports(Request $request): Response
    {
        $this->requireStaff($request);

        $reports = Report::with([
            'reporter:id,name',
            'reportedUser:id,name,role,is_banned',
        ])
            ->where('status', 'open')
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('Staff/Reports', ['reports' => $reports]);
    }

    public function dismissReport(Report $report, Request $request)
    {
        $this->requireStaff($request);

        $report->update([
            'status'      => 'dismissed',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        $this->logAction($request->user()->id, 'dismiss_report', null, null, "Dismissed report #{$report->id}");

        return back()->with('success', 'Report dismissed.');
    }

    // ─── Bans ─────────────────────────────────────────────────────────────────

    public function bans(Request $request): Response
    {
        $this->requireStaff($request);

        $bans = Ban::with(['user:id,name', 'staff:id,name'])
            ->active()
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('Staff/Bans', ['bans' => $bans]);
    }

    public function banUser(Request $request)
    {
        $this->requireStaff($request);

        $validated = $request->validate([
            'user_id'    => 'required|integer|exists:users,id',
            'reason'     => 'required|string|max:500',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $target = User::findOrFail($validated['user_id']);
        $staff  = $request->user();

        if ($target->role === 'admin' && $staff->role !== 'admin') {
            return back()->with('error', 'You cannot ban an admin.');
        }

        if ($target->id === $staff->id) {
            return back()->with('error', 'You cannot ban yourself.');
        }

        try {
            DB::transaction(function () use ($target, $staff, $validated) {
                Ban::create([
                    'user_id'    => $target->id,
                    'staff_id'   => $staff->id,
                    'reason'     => $validated['reason'],
                    'expires_at' => $validated['expires_at'] ?? null,
                    'is_active'  => true,
                ]);

                $target->update([
                    'is_banned'    => true,
                    'banned_until' => $validated['expires_at'] ?? null,
                ]);
            });

            $this->logAction($staff->id, 'ban', $target->id, null, $validated['reason'], ['expires_at' => $validated['expires_at'] ?? 'permanent']);

            return back()->with('success', "User '{$target->name}' has been banned.");
        } catch (Throwable $e) {
            Log::error('StaffController::banUser error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Ban failed.');
        }
    }

    public function unbanUser(Request $request)
    {
        $this->requireStaff($request);

        $validated = $request->validate(['user_id' => 'required|integer|exists:users,id']);
        $target    = User::findOrFail($validated['user_id']);

        try {
            DB::transaction(function () use ($target, $request) {
                Ban::where('user_id', $target->id)->active()->update(['is_active' => false]);
                $target->update(['is_banned' => false, 'banned_until' => null]);
            });

            $this->logAction($request->user()->id, 'unban', $target->id);

            return back()->with('success', "User '{$target->name}' has been unbanned.");
        } catch (Throwable $e) {
            Log::error('StaffController::unbanUser error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Unban failed.');
        }
    }

    // ─── Items ────────────────────────────────────────────────────────────────

    public function items(Request $request): Response
    {
        $this->requireStaff($request);

        $items = Item::withTrashed()
            ->with('creator:id,name')
            ->orderByDesc('created_at')
            ->paginate(30);

        return Inertia::render('Staff/Items', ['items' => $items]);
    }

    public function approveItem(Item $item, Request $request)
    {
        $this->requireStaff($request);
        $item->update(['is_approved' => true]);
        $this->logAction($request->user()->id, 'item_approve', null, $item->id);

        return back()->with('success', "Item '{$item->name}' approved.");
    }

    public function removeItem(Item $item, Request $request)
    {
        $this->requireStaff($request);
        $item->delete();
        $this->logAction($request->user()->id, 'item_remove', null, $item->id, "Item removed from catalog");

        return back()->with('success', "Item '{$item->name}' removed.");
    }

    // ─── Economy (Admin only) ─────────────────────────────────────────────────

    public function grantKitties(Request $request)
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'amount'  => 'required|integer|min:1|max:999999999',
            'reason'  => 'nullable|string|max:300',
        ]);

        $target = User::findOrFail($validated['user_id']);

        $this->economy->grant(
            $target,
            $validated['amount'],
            'admin_grant',
            $validated['reason'] ?? "Admin grant by {$request->user()->name}",
            null, null
        );

        $this->logAction($request->user()->id, 'grant_kitties', $target->id, null, null, ['amount' => $validated['amount']]);

        return back()->with('success', "Granted {$validated['amount']} Kitties to {$target->name}.");
    }

    public function grantItem(Request $request)
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'item_id' => 'required|integer|exists:items,id',
        ]);

        $target = User::findOrFail($validated['user_id']);
        $item   = Item::findOrFail($validated['item_id']);

        UserItem::create([
            'user_id'        => $target->id,
            'item_id'        => $item->id,
            'original_price' => 0,
        ]);

        $this->logAction($request->user()->id, 'grant_item', $target->id, $item->id);

        return back()->with('success', "Granted '{$item->name}' to {$target->name}.");
    }

    // ─── User Search ──────────────────────────────────────────────────────────

    public function searchUsers(Request $request)
    {
        $this->requireStaff($request);

        $query = $request->validate(['q' => 'required|string|min:2|max:50'])['q'];

        $users = User::where('name', 'like', "%{$query}%")
            ->orWhere('email', 'like', "%{$query}%")
            ->limit(15)
            ->get(['id', 'name', 'email', 'role', 'is_banned', 'kitties', 'created_at']);

        return response()->json($users);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function requireStaff(Request $request): void
    {
        if (!in_array($request->user()?->role, ['moderator', 'admin'])) {
            abort(403);
        }
    }

    private function requireAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403, 'Admin access required.');
        }
    }

    private function logAction(int $staffId, string $action, ?int $targetUserId = null, ?int $targetItemId = null, ?string $notes = null, ?array $meta = null): void
    {
        try {
            StaffAction::create([
                'staff_id'       => $staffId,
                'action'         => $action,
                'target_user_id' => $targetUserId,
                'target_item_id' => $targetItemId,
                'notes'          => $notes,
                'meta'           => $meta,
            ]);
        } catch (Throwable $e) {
            Log::error('StaffController: failed to log action', ['error' => $e->getMessage()]);
        }
    }
}
