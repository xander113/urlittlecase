<?php

namespace App\Http\Controllers;

use App\Events\ItemPurchased;
use App\Jobs\GenerateThumbnail;
use App\Models\Item;
use App\Models\UserItem;
use App\Services\EconomyService;
use App\Services\RAPService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ItemController extends Controller
{
    public function __construct(
        private EconomyService $economy,
        private RAPService $rap,
    ) {}

    public function index(Request $request): Response
    {
        $query = Item::forSale()
            ->with('creator:id,name')
            ->withCount('userItems');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $sort = $request->get('sort', 'created_at');
        $dir  = $request->get('dir', 'desc');
        $allowedSorts = ['name', 'price', 'created_at', 'rap'];
        if (in_array($sort, $allowedSorts)) {
            $query->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        }

        $items = $query->paginate(24)->withQueryString();

        return Inertia::render('Items/Index', [
            'items'      => $items,
            'filters'    => $request->only(['search', 'category', 'type', 'sort', 'dir']),
            'categories' => ['hat', 'face', 'shirt', 'pants', 'shoes', 'accessory', 'gear'],
        ]);
    }

    public function show(Item $item): Response
    {
        $item->load('creator:id,name');
        $priceHistory = $item->type === 'limited'
            ? $this->rap->chartData($item)
            : [];

        $cheapestListing = null;
        if ($item->type === 'limited') {
            $cheapestListing = $item->marketListings()
                ->active()
                ->with('seller:id,name')
                ->orderBy('price')
                ->first();
        }

        return Inertia::render('Items/Show', [
            'item'            => $item,
            'priceHistory'    => $priceHistory,
            'cheapestListing' => $cheapestListing,
        ]);
    }

    /**
     * Purchase a regular item directly from the catalog.
     */
    public function purchase(Request $request, Item $item)
    {
        $user = $request->user();

        try {
            if (!$item->is_for_sale || !$item->is_approved) {
                return back()->with('error', 'This item is not available.');
            }

            if ($item->type !== 'regular') {
                return back()->with('error', 'Limited items must be purchased from the market.');
            }

            DB::transaction(function () use ($user, $item) {
                $freshItem = Item::lockForUpdate()->findOrFail($item->id);

                if (!$this->economy->deduct(
                    $user, $freshItem->price, 'purchase',
                    "Purchased: {$freshItem->name}", $freshItem->id, 'item'
                )) {
                    throw new \RuntimeException('Insufficient Kitties.');
                }

                UserItem::create([
                    'user_id'        => $user->id,
                    'item_id'        => $freshItem->id,
                    'original_price' => $freshItem->price,
                ]);

                // Credit the catalog (no seller for regular items — goes to house)
                // Real deployment: could credit a system account here.
            });

            return back()->with('success', "You purchased {$item->name}!");
        } catch (\RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        } catch (Throwable $e) {
            Log::error('ItemController::purchase error', ['error' => $e->getMessage(), 'item_id' => $item->id]);
            return back()->with('error', 'Purchase failed. Please try again.');
        }
    }

    // ─── Admin/Staff ──────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $this->authorize('create', Item::class);

        $validated = $request->validate([
            'name'            => 'required|string|max:100',
            'description'     => 'nullable|string|max:1000',
            'type'            => 'required|in:regular,limited',
            'category'        => 'required|in:hat,face,shirt,pants,shoes,accessory,gear',
            'price'           => 'required|integer|min:0',
            'stock'           => 'nullable|integer|min:1',
            'color_primary'   => 'required|string|max:7',
            'color_secondary' => 'required|string|max:7',
            'is_for_sale'     => 'boolean',
        ]);

        $validated['creator_id'] = $request->user()->id;

        if ($validated['type'] === 'limited' && isset($validated['stock'])) {
            $validated['stock_remaining'] = $validated['stock'];
        }

        $item = Item::create($validated);

        // Queue thumbnail generation
        GenerateThumbnail::dispatch($item->id, 'item');

        return back()->with('success', "Item '{$item->name}' created.");
    }

    public function approve(Item $item, Request $request)
    {
        $this->authorize('approve', $item);
        $item->update(['is_approved' => true]);

        return back()->with('success', "Item approved.");
    }

    public function destroy(Item $item, Request $request)
    {
        $this->authorize('delete', $item);
        $item->delete();

        return back()->with('success', 'Item removed from catalog.');
    }
}
