<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int    $userId,
        public string $type,    // trade | market | ban | system
        public string $message,
        public array  $data = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel("notifications.{$this->userId}")];
    }

    public function broadcastWith(): array
    {
        return [
            'type'    => $this->type,
            'message' => $this->message,
            'data'    => $this->data,
            'at'      => now()->toIso8601String(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification';
    }
}
