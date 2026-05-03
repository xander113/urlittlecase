<?php

namespace App\Jobs;

use App\Models\Avatar;
use App\Models\Item;
use App\Models\User;
use App\Services\ThumbnailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateThumbnail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 60;

    public function __construct(
        public int    $modelId,
        public string $modelType, // 'item' | 'avatar'
    ) {}

    public function handle(ThumbnailService $thumbnails): void
    {
        try {
            match ($this->modelType) {
                'item'   => $this->handleItem($thumbnails),
                'avatar' => $this->handleAvatar($thumbnails),
                default  => throw new \InvalidArgumentException("Unknown model type: {$this->modelType}"),
            };
        } catch (Throwable $e) {
            Log::error('GenerateThumbnail job failed', [
                'type'  => $this->modelType,
                'id'    => $this->modelId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handleItem(ThumbnailService $thumbnails): void
    {
        $item = Item::find($this->modelId);
        if (!$item) {
            return;
        }

        $url = $thumbnails->generateItemThumbnail($item);
        if ($url) {
            $item->update(['thumbnail_url' => $url]);
        }
    }

    private function handleAvatar(ThumbnailService $thumbnails): void
    {
        $avatar = Avatar::find($this->modelId);
        if (!$avatar) {
            return;
        }

        $path = $thumbnails->generateAvatarThumbnail($avatar);
        if ($path) {
            $url = Storage::disk('public')->url($path);
            $avatar->update(['thumbnail_path' => $path]);
            // Also update the user's avatar thumbnail for quick display
            User::where('id', $avatar->user_id)->update(['avatar_thumbnail' => $url]);
        }
    }

    public function failed(Throwable $e): void
    {
        Log::error('GenerateThumbnail permanently failed', ['error' => $e->getMessage()]);
    }
}
