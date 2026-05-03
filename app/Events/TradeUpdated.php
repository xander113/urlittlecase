<?php

namespace App\Events;

use App\Models\Trade;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TradeUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Trade  $trade,
        public string $action, // created | completed | declined | cancelled | expired
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("trade.user.{$this->trade->sender_id}"),
            new PrivateChannel("trade.user.{$this->trade->receiver_id}"),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'trade_id'    => $this->trade->id,
            'action'      => $this->action,
            'sender_id'   => $this->trade->sender_id,
            'receiver_id' => $this->trade->receiver_id,
            'status'      => $this->trade->status,
        ];
    }

    public function broadcastAs(): string
    {
        return 'trade.updated';
    }
}
