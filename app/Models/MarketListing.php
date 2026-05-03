<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketListing extends Model
{
    protected $fillable = [
        'user_item_id', 'seller_id', 'item_id', 'price',
        'status', 'buyer_id', 'sold_at',
    ];

    protected $casts = [
        'price'   => 'integer',
        'sold_at' => 'datetime',
    ];

    public function userItem(): BelongsTo
    {
        return $this->belongsTo(UserItem::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
