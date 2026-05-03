<?php

namespace App\Events;

use App\Models\ForumPost;
use App\Models\ForumThread;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ForumPostCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public ForumPost   $post,
        public ForumThread $thread,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel("forum.thread.{$this->thread->id}")];
    }

    public function broadcastWith(): array
    {
        return [
            'post_id'   => $this->post->id,
            'thread_id' => $this->thread->id,
            'author'    => $this->post->author?->name,
        ];
    }

    public function broadcastAs(): string { return 'post.created'; }
}
