<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class YlcNotification extends Model
{
    protected $table    = 'ylc_notifications';
    protected $fillable = ['user_id','type','message','data','link','is_read'];
    protected $casts    = ['data' => 'array', 'is_read' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Create a notification and broadcast it via Reverb.
     */
    public static function send(int $userId, string $type, string $message, ?string $link = null, array $data = []): self
    {
        $notif = static::create([
            'user_id' => $userId,
            'type'    => $type,
            'message' => $message,
            'link'    => $link,
            'data'    => $data,
            'is_read' => false,
        ]);

        try {
            broadcast(new \App\Events\NotificationSent(
                $userId, $type, $message, array_merge($data, ['link' => $link])
            ))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('YlcNotification::send broadcast failed', ['error' => $e->getMessage()]);
        }

        return $notif;
    }
}
