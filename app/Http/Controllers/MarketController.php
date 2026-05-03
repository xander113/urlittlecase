<?php

namespace App\Http\Controllers;

use App\Events\MarketUpdated;
use App\Models\Item;
use App\Models\MarketListing;
use App\Models\UserItem;
use App\Services\EconomyService;
use App\Services\RAPService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class MarketController extends Controller
{
    public function __construct(
        private EconomyService $economy,
        private RAPService $rap,
    ) {}

    public function index(Request $request): Response
    {
        $query = MarketListing::active()
            ->with(['item', 'seller:id,name'])
            ->join('items', 'items.id', '=', 'market_listings.item_id');

        if ($request->filled('item_id')) {
            $query->where('market_listings.item_id', $request->item_id);
        }

        if ($request->filled('search')) {
            $query->where('items.name', 'like', '%' . $request->search . '%');
        }

        $listings = $query
            ->select('market_listings.*')
            ->orderBy('market_listings.price')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Market/Index', [
            'listings' => $listings,
            'filters'  => $request->only(['search', 'item_id']),
        ]);
    }

    /**
     * List a user_item on the market.
     */
    public function list(Request $request)
    {
        $validated = $request->validate([
            'user_item_id' => 'required|integer|exists:user_items,id',
            'price'        => 'required|integer|min:1|max:999999999',
        ]);

        $user     = $request->user();
        $userItem = UserItem::with('item')->findOrFail($validated['user_item_id']);

        try {
            if ($userItem->user_id !== $user->id) {
                return back()->with('error', 'You do not own this item.');
            }

            if ($userItem->item->type !== 'limited') {
                return back()->with('error', 'Only limited items can be listed on the market.');
            }

            if (!$userItem->is_available) {
                return back()->with('error', 'This item is already listed or in a trade.');
            }

            DB::transaction(function () use ($userItem, $user, $validated) {
                $userItem->update(['is_listed' => true]);

                MarketListing::create([
                    'user_item_id' => $userItem->id,
                    'seller_id'    => $user->id,
                    'item_id'      => $userItem->item_id,
                    'price'        => $validated['price'],
                    'status'       => 'active',
                ]);
            });

            broadcast(new MarketUpdated($userItem->item_id))->toOthers();

            return back()->with('success', 'Item listed on the market.');
        } catch (Throwable $e) {
            Log::error('MarketController::list error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Listing failed. Please try again.');
        }
    }

    /**
     * Buy a market listing.
     */
    public function buy(Request $request, MarketListing $listing)
    {
        $buyer = $request->user();

        try {
            if ($listing->status !== 'active') {
                return back()->with('error', 'This listing is no longer available.');
            }

            if ($listing->seller_id === $buyer->id) {
                return back()->with('error', 'You cannot buy your own listing.');
            }

            $seller = $listing->seller;

            DB::transaction(function () use ($buyer, $seller, $listing) {
                $freshListing = MarketListing::lockForUpdate()->findOrFail($listing->id);

                if ($freshListing->status !== 'active') {
                    throw new \RuntimeException('Listing sold out.');
                }

                // Transfer kitties
                if (!$this->economy->transfer(
                    $buyer, $seller, $freshListing->price,
                    'sale', "Market purchase of {$freshListing->item->name}",
                    $freshListing->id, 'market_listing'
                )) {
                    throw new \RuntimeException('Insufficient Kitties.');
                }

                // Transfer item ownership
                $freshListing->userItem->update(['user_id' => $buyer->id, 'is_listed' => false]);

                $freshListing->update([
                    'status'   => 'sold',
                    'buyer_id' => $buyer->id,
                    'sold_at'  => now(),
                ]);

                // Record sale for RAP
                $this->rap->recordSale(
                    $freshListing->item,
                    $freshListing->price,
                    $seller->id,
                    $buyer->id
                );
            });

            broadcast(new MarketUpdated($listing->item_id))->toOthers();

            return back()->with('success', "You purchased {$listing->item->name}!");
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        } catch (Throwable $e) {
            Log::error('MarketController::buy error', ['error' => $e->getMessage(), 'listing_id' => $listing->id]);
            return back()->with('error', 'Purchase failed. Please try again.');
        }
    }

    /**
     * Cancel your own listing.
     */
    public function cancel(Request $request, MarketListing $listing)
    {
        $user = $request->user();

        if ($listing->seller_id !== $user->id) {
            return back()->with('error', 'You do not own this listing.');
        }

        if ($listing->status !== 'active') {
            return back()->with('error', 'This listing is not active.');
        }

        try {
            DB::transaction(function () use ($listing) {
                $listing->update(['status' => 'cancelled']);
                $listing->userItem->update(['is_listed' => false]);
            });

            broadcast(new MarketUpdated($listing->item_id))->toOthers();

            return back()->with('success', 'Listing cancelled.');
        } catch (Throwable $e) {
            Log::error('MarketController::cancel error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Could not cancel listing.');
        }
    }
}
