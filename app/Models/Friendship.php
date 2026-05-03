<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Friendship extends Model
{
    protected $fillable = ['sender_id','receiver_id','status'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function scopeAccepted($query)
    {
        return $query->where('status', 'accepted');
    }

    public static function statusFor(int $viewerId, int $profileId): string
    {
        $row = static::where(function ($q) use ($viewerId, $profileId) {
            $q->where(['sender_id' => $viewerId, 'receiver_id' => $profileId])
              ->orWhere(['sender_id' => $profileId, 'receiver_id' => $viewerId]);
        })->first();

        if (!$row) return 'none';
        if ($row->status === 'accepted') return 'friends';
        if ($row->status === 'pending') {
            return $row->sender_id === $viewerId ? 'pending' : 'incoming';
        }
        return 'none';
    }
}
