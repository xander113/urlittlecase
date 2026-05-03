<?php

namespace App\Services;

use App\Models\Item;
use App\Models\LimitedPriceHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class RAPService
{
    private const RAP_WINDOW = 30; // last N sales

    /**
     * Record a sale and update the item's RAP.
     */
    public function recordSale(Item $item, int $price, int $sellerId, int $buyerId): void
    {
        try {
            DB::transaction(function () use ($item, $price, $sellerId, $buyerId) {
                LimitedPriceHistory::create([
                    'item_id'   => $item->id,
                    'price'     => $price,
                    'seller_id' => $sellerId,
                    'buyer_id'  => $buyerId,
                    'sold_at'   => now(),
                ]);

                $this->recalculate($item);
            });
        } catch (Throwable $e) {
            Log::error('RAPService::recordSale failed', ['item_id' => $item->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Recalculate and persist RAP for a limited item.
     */
    public function recalculate(Item $item): void
    {
        try {
            $history = LimitedPriceHistory::where('item_id', $item->id)
                ->orderByDesc('sold_at')
                ->limit(self::RAP_WINDOW)
                ->pluck('price');

            if ($history->isEmpty()) {
                return;
            }

            $rap = (int) round($history->average());

            $item->update([
                'rap'             => $rap,
                'rap_sales_count' => $item->rap_sales_count + 1,
            ]);
        } catch (Throwable $e) {
            Log::error('RAPService::recalculate failed', ['item_id' => $item->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Get price history chart data for frontend.
     */
    public function chartData(Item $item, int $points = 60): array
    {
        return LimitedPriceHistory::where('item_id', $item->id)
            ->orderByDesc('sold_at')
            ->limit($points)
            ->get(['price', 'sold_at'])
            ->map(fn ($h) => ['price' => $h->price, 'date' => $h->sold_at->toDateString()])
            ->reverse()
            ->values()
            ->toArray();
    }
}
