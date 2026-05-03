<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MarketUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $itemId) {}

    public function broadcastOn(): array
    {
        return [
            new Channel("market.item.{$this->itemId}"),
        ];
    }

    public function broadcastWith(): array
    {
        return ['item_id' => $this->itemId];
    }

    public function broadcastAs(): string
    {
        return 'market.updated';
    }
}
