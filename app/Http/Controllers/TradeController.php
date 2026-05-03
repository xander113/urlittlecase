<?php

namespace App\Http\Controllers;

use App\Events\TradeUpdated;
use App\Models\Trade;
use App\Models\TradeItem;
use App\Models\User;
use App\Models\UserItem;
use App\Services\EconomyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class TradeController extends Controller
{
    private const MAX_ITEMS_PER_SIDE = 4;
    private const MAX_KITTIES        = 100_000_000;
    private const EXPIRE_HOURS       = 72;

    public function __construct(private EconomyService $economy) {}

    public function index(Request $request): Response
    {
        $user   = $request->user();
        $trades = Trade::where('sender_id', $user->id)
            ->orWhere('receiver_id', $user->id)
            ->with([
                'sender:id,name,avatar_thumbnail',
                'receiver:id,name,avatar_thumbnail',
                'senderItems.userItem.item',
                'receiverItems.userItem.item',
            ])
            ->orderByDesc('created_at')
            ->paginate(15);

        return Inertia::render('Trade/Index', ['trades' => $trades]);
    }

    /**
     * Dedicated GET page for creating a new trade — prevents /trade/create
     * from being swallowed by the {trade} route parameter.
     */
    public function createPage(Request $request): Response
    {
        $user = $request->user();

        // Load the user's tradeable items (limited, available)
        $myItems = UserItem::where('user_id', $user->id)
            ->available()
            ->with('item:id,name,thumbnail_url,type,category,rap,color_primary')
            ->whereHas('item', fn ($q) => $q->where('type', 'limited'))
            ->get();

        // Optional: pre-select a partner if ?user_id=X is passed
        $partner = null;
        if ($request->filled('user_id')) {
            $partner = User::select('id', 'name', 'avatar_thumbnail')
                ->where('id', $request->user_id)
                ->where('id', '!=', $user->id)
                ->first();

            if ($partner) {
                $partner->items = UserItem::where('user_id', $partner->id)
                    ->available()
                    ->with('item:id,name,thumbnail_url,type,category,rap,color_primary')
                    ->whereHas('item', fn ($q) => $q->where('type', 'limited'))
                    ->get();
            }
        }

        return Inertia::render('Trade/Create', [
            'myItems'  => $myItems,
            'partner'  => $partner,
            'balance'  => $user->kitties,
        ]);
    }

    public function show(Trade $trade, Request $request): Response
    {
        $user = $request->user();

        if ($trade->sender_id !== $user->id && $trade->receiver_id !== $user->id) {
            abort(403);
        }

        $trade->load([
            'sender:id,name,avatar_thumbnail',
            'receiver:id,name,avatar_thumbnail',
            'senderItems.userItem.item',
            'receiverItems.userItem.item',
        ]);

        return Inertia::render('Trade/Show', ['trade' => $trade]);
    }

    public function create(Request $request)
    {
        $validated = $request->validate([
            'receiver_id'           => 'required|integer|exists:users,id|different:' . $request->user()->id,
            'sender_item_ids'       => 'required|array|min:1|max:' . self::MAX_ITEMS_PER_SIDE,
            'sender_item_ids.*'     => 'integer|exists:user_items,id',
            'receiver_item_ids'     => 'required|array|min:1|max:' . self::MAX_ITEMS_PER_SIDE,
            'receiver_item_ids.*'   => 'integer|exists:user_items,id',
            'sender_kitties'        => 'nullable|integer|min:0|max:' . self::MAX_KITTIES,
            'receiver_kitties'      => 'nullable|integer|min:0|max:' . self::MAX_KITTIES,
            'sender_note'           => 'nullable|string|max:300',
        ]);

        $sender   = $request->user();
        $receiver = User::findOrFail($validated['receiver_id']);

        if ($receiver->is_banned) {
            return back()->with('error', 'Cannot trade with a suspended user.');
        }

        $pendingCount = Trade::where('sender_id', $sender->id)->pending()->count();
        if ($pendingCount >= 10) {
            return back()->with('error', 'You have too many pending trades. Wait for responses.');
        }

        try {
            DB::transaction(function () use ($sender, $receiver, $validated) {
                $senderKitties   = $validated['sender_kitties']   ?? 0;
                $receiverKitties = $validated['receiver_kitties'] ?? 0;

                foreach ($validated['sender_item_ids'] as $id) {
                    $item = UserItem::lockForUpdate()->findOrFail($id);
                    if ($item->user_id !== $sender->id || !$item->is_available) {
                        throw new \RuntimeException("Item #{$id} is not available for trade.");
                    }
                }

                foreach ($validated['receiver_item_ids'] as $id) {
                    $item = UserItem::lockForUpdate()->findOrFail($id);
                    if ($item->user_id !== $receiver->id || !$item->is_available) {
                        throw new \RuntimeException("Item #{$id} is not available for trade.");
                    }
                }

                if ($senderKitties > 0 && $sender->kitties < $senderKitties) {
                    throw new \RuntimeException('You don\'t have enough Kitties for this trade offer.');
                }

                UserItem::whereIn('id', $validated['sender_item_ids'])->update(['in_trade' => true]);
                UserItem::whereIn('id', $validated['receiver_item_ids'])->update(['in_trade' => true]);

                $trade = Trade::create([
                    'sender_id'        => $sender->id,
                    'receiver_id'      => $receiver->id,
                    'status'           => 'pending',
                    'sender_kitties'   => $senderKitties,
                    'receiver_kitties' => $receiverKitties,
                    'sender_note'      => $validated['sender_note'] ?? null,
                    'expires_at'       => now()->addHours(self::EXPIRE_HOURS),
                ]);

                foreach ($validated['sender_item_ids'] as $id) {
                    TradeItem::create(['trade_id' => $trade->id, 'user_item_id' => $id, 'side' => 'sender']);
                }
                foreach ($validated['receiver_item_ids'] as $id) {
                    TradeItem::create(['trade_id' => $trade->id, 'user_item_id' => $id, 'side' => 'receiver']);
                }

                broadcast(new TradeUpdated($trade, 'created'))->toOthers();
            });

            return redirect('/trade')->with('success', 'Trade offer sent!');
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        } catch (Throwable $e) {
            Log::error('TradeController::create error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Trade creation failed. Please try again.');
        }
    }

    public function accept(Trade $trade, Request $request)
    {
        $user = $request->user();
        if ($trade->receiver_id !== $user->id) return back()->with('error', 'You cannot accept this trade.');
        if ($trade->status !== 'pending' || $trade->is_expired) return back()->with('error', 'This trade is no longer pending.');

        try {
            DB::transaction(function () use ($trade) {
                $freshTrade = Trade::lockForUpdate()->findOrFail($trade->id);
                if ($freshTrade->status !== 'pending') throw new \RuntimeException('Trade already resolved.');

                $sender   = User::lockForUpdate()->findOrFail($freshTrade->sender_id);
                $receiver = User::lockForUpdate()->findOrFail($freshTrade->receiver_id);

                if ($freshTrade->sender_kitties > 0 && $sender->kitties < $freshTrade->sender_kitties) throw new \RuntimeException('Sender has insufficient Kitties.');
                if ($freshTrade->receiver_kitties > 0 && $receiver->kitties < $freshTrade->receiver_kitties) throw new \RuntimeException('You have insufficient Kitties for this trade.');

                if ($freshTrade->sender_kitties > 0) $this->economy->transfer($sender, $receiver, $freshTrade->sender_kitties, 'trade', "Trade #{$freshTrade->id}", $freshTrade->id, 'trade');
                if ($freshTrade->receiver_kitties > 0) $this->economy->transfer($receiver, $sender, $freshTrade->receiver_kitties, 'trade', "Trade #{$freshTrade->id}", $freshTrade->id, 'trade');

                UserItem::whereIn('id', $freshTrade->senderItems()->pluck('user_item_id'))->update(['user_id' => $freshTrade->receiver_id, 'in_trade' => false]);
                UserItem::whereIn('id', $freshTrade->receiverItems()->pluck('user_item_id'))->update(['user_id' => $freshTrade->sender_id, 'in_trade' => false]);

                $freshTrade->update(['status' => 'completed']);
                broadcast(new TradeUpdated($freshTrade, 'completed'))->toOthers();
            });

            return back()->with('success', 'Trade completed!');
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        } catch (Throwable $e) {
            Log::error('TradeController::accept error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Trade acceptance failed.');
        }
    }

    public function decline(Trade $trade, Request $request)
    {
        if ($trade->receiver_id !== $request->user()->id) return back()->with('error', 'You cannot decline this trade.');
        $this->resolveTrade($trade, 'declined');
        return back()->with('success', 'Trade declined.');
    }

    public function cancel(Trade $trade, Request $request)
    {
        if ($trade->sender_id !== $request->user()->id) return back()->with('error', 'You cannot cancel this trade.');
        if ($trade->status !== 'pending') return back()->with('error', 'Trade cannot be cancelled.');
        $this->resolveTrade($trade, 'cancelled');
        return back()->with('success', 'Trade cancelled.');
    }

    private function resolveTrade(Trade $trade, string $status): void
    {
        try {
            DB::transaction(function () use ($trade, $status) {
                UserItem::whereIn('id', $trade->tradeItems()->pluck('user_item_id'))->update(['in_trade' => false]);
                $trade->update(['status' => $status]);
                broadcast(new TradeUpdated($trade, $status))->toOthers();
            });
        } catch (Throwable $e) {
            Log::error('TradeController::resolveTrade error', ['error' => $e->getMessage()]);
        }
    }
}
