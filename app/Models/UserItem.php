<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class UserItem extends Model
{
    protected $fillable = [
        'user_id', 'item_id', 'serial_number', 'original_price',
        'is_listed', 'in_trade',
    ];

    protected $casts = [
        'original_price' => 'integer',
        'is_listed'      => 'boolean',
        'in_trade'       => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function activeListing(): HasOne
    {
        return $this->hasOne(MarketListing::class)->where('status', 'active');
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_listed', false)->where('in_trade', false);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function getIsAvailableAttribute(): bool
    {
        return !$this->is_listed && !$this->in_trade;
    }
}
