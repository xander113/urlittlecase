<?php

namespace App\Jobs;

use App\Events\TradeUpdated;
use App\Models\Trade;
use App\Models\UserItem;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class ExpireTrades implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 120;

    public function handle(): void
    {
        $expired = Trade::pending()
            ->where('expires_at', '<', now())
            ->get();

        foreach ($expired as $trade) {
            try {
                DB::transaction(function () use ($trade) {
                    $fresh = Trade::lockForUpdate()->find($trade->id);
                    if (!$fresh || $fresh->status !== 'pending') {
                        return;
                    }

                    $itemIds = $fresh->tradeItems()->pluck('user_item_id');
                    UserItem::whereIn('id', $itemIds)->update(['in_trade' => false]);
                    $fresh->update(['status' => 'expired']);

                    broadcast(new TradeUpdated($fresh, 'expired'))->toOthers();
                });
            } catch (Throwable $e) {
                Log::error('ExpireTrades: failed to expire trade', ['trade_id' => $trade->id, 'error' => $e->getMessage()]);
            }
        }
    }

    public function failed(Throwable $e): void
    {
        Log::error('ExpireTrades job permanently failed', ['error' => $e->getMessage()]);
    }
}
