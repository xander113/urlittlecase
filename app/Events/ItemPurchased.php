<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ItemPurchased implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $itemId,
        public int $buyerId,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel("catalog.item.{$this->itemId}")];
    }

    public function broadcastWith(): array
    {
        return ['item_id' => $this->itemId, 'buyer_id' => $this->buyerId];
    }

    public function broadcastAs(): string
    {
        return 'item.purchased';
    }
}
