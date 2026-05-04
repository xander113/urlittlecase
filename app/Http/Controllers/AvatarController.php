<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateThumbnail;
use App\Models\Avatar;
use App\Models\User;
use App\Models\UserItem;
use App\Services\RCCService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AvatarController extends Controller
{
    public function __construct(private RCCService $rcc) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $avatar = Avatar::firstOrCreate(
            ['user_id' => $user->id],
            ['body_color' => '#D9D9D9']
        );

        $inventory = UserItem::where('user_id', $user->id)
            ->with('item:id,name,category,thumbnail_url,color_primary,color_secondary,type')
            ->get()
            ->groupBy('item.category');

        return Inertia::render('Avatar/Index', [
            'avatar'    => $avatar,
            'inventory' => $inventory,
            'slots'     => Avatar::slots(),
        ]);
    }

    public function save(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'body_color'             => 'nullable|string|regex:/^#[0-9a-fA-F]{6}$/',
            'hat_user_item_id'       => 'nullable|integer|exists:user_items,id',
            'face_user_item_id'      => 'nullable|integer|exists:user_items,id',
            'shirt_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'pants_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'shoes_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'accessory_user_item_id' => 'nullable|integer|exists:user_items,id',
        ]);

        try {
            $slotColumns = [
                'hat_user_item_id','face_user_item_id','shirt_user_item_id',
                'pants_user_item_id','shoes_user_item_id','accessory_user_item_id',
            ];

            foreach ($slotColumns as $col) {
                if (empty($validated[$col])) continue;
                $slot = str_replace('_user_item_id', '', $col);
                $uItem = UserItem::with('item:id,category')->find($validated[$col]);
                if (!$uItem || $uItem->user_id !== $user->id) {
                    return back()->with('error', "You don't own one of the selected items.");
                }
                if ($uItem->item && $uItem->item->category !== $slot) {
                    return back()->with('error', "Item category doesn't match slot.");
                }
            }

            $avatar = Avatar::updateOrCreate(
                ['user_id' => $user->id],
                array_merge(['body_color' => '#D9D9D9'], $validated)
            );

            // Queue async thumbnail generation via Python RCC
            GenerateThumbnail::dispatch($avatar->id, 'avatar');

            return back()->with('success', 'Avatar saved!');
        } catch (Throwable $e) {
            Log::error('AvatarController::save', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to save avatar.');
        }
    }

    /**
     * POST /avatar/thumbnail
     *
     * JSON endpoint — called by the browser via axios (CSRF-safe).
     * Accepts avatar config, dispatches to the Python RCC service server-side,
     * and returns the thumbnail URL as JSON.
     *
     * The browser NEVER calls the SOAP endpoint directly.
     * This is the correct Roblox-like architecture: client → web server → RCCService.
     */
    public function regenerateThumbnail(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'body_color'   => 'nullable|string|max:20',
            'slot_colors'  => 'nullable|array',
            'slot_colors.*'=> 'nullable|array',
        ]);

        $bodyColor  = $validated['body_color']  ?? '#D9D9D9';
        $slotColors = $validated['slot_colors'] ?? [];

        try {
            // Build an in-memory Avatar model from the request data so we can
            // pass it to RCCService without hitting the database.
            $avatar = new Avatar([
                'user_id'    => $user->id,
                'body_color' => $bodyColor,
            ]);

            // Call the Python RCC service synchronously for the live preview.
            // For production thumbnail persistence, the async job is used instead.
            $url = $this->rcc->renderAvatarFromColors($bodyColor, $slotColors, $user->id);

            if (!$url) {
                return response()->json(['error' => 'Thumbnail service unavailable. Try saving the avatar to regenerate.'], 503);
            }

            // Persist the thumbnail URL to the user record so the nav shows it
            User::where('id', $user->id)->update(['avatar_thumbnail' => $url]);

            return response()->json(['url' => $url]);
        } catch (Throwable $e) {
            Log::error('AvatarController::regenerateThumbnail', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to generate thumbnail.'], 500);
        }
    }
}
