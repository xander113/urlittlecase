<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trade extends Model
{
    protected $fillable = [
        'sender_id', 'receiver_id', 'status',
        'sender_kitties', 'receiver_kitties', 'sender_note', 'expires_at',
    ];

    protected $casts = [
        'sender_kitties'   => 'integer',
        'receiver_kitties' => 'integer',
        'expires_at'       => 'datetime',
    ];

    const STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'expired', 'completed'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function tradeItems(): HasMany
    {
        return $this->hasMany(TradeItem::class);
    }

    public function senderItems(): HasMany
    {
        return $this->hasMany(TradeItem::class)->where('side', 'sender');
    }

    public function receiverItems(): HasMany
    {
        return $this->hasMany(TradeItem::class)->where('side', 'receiver');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
