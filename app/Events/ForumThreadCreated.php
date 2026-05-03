<?php

namespace App\Events;

use App\Models\ForumThread;
use App\Models\ForumCategory;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ForumThreadCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public ForumThread   $thread,
        public ForumCategory $category,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel("forum.category.{$this->category->id}")];
    }

    public function broadcastWith(): array
    {
        return [
            'thread_id'   => $this->thread->id,
            'title'       => $this->thread->title,
            'slug'        => $this->thread->slug,
            'category_id' => $this->category->id,
        ];
    }

    public function broadcastAs(): string { return 'thread.created'; }
}
