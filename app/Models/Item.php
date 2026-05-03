<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Item extends Model
{
    use SoftDeletes, HasFactory;

    protected $fillable = [
        'name', 'description', 'type', 'category', 'price', 'stock',
        'stock_remaining', 'is_for_sale', 'is_approved', 'thumbnail_url',
        'asset_url', 'color_primary', 'color_secondary', 'creator_id',
        'rap', 'rap_sales_count',
    ];

    protected $casts = [
        'price'           => 'integer',
        'stock'           => 'integer',
        'stock_remaining' => 'integer',
        'is_for_sale'     => 'boolean',
        'is_approved'     => 'boolean',
        'rap'             => 'integer',
        'rap_sales_count' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function userItems(): HasMany
    {
        return $this->hasMany(UserItem::class);
    }

    public function marketListings(): HasMany
    {
        return $this->hasMany(MarketListing::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(LimitedPriceHistory::class);
    }

    public function scopeRegular($query)
    {
        return $query->where('type', 'regular');
    }

    public function scopeLimited($query)
    {
        return $query->where('type', 'limited');
    }

    public function scopeForSale($query)
    {
        return $query->where('is_for_sale', true)->where('is_approved', true);
    }

    public function getIsLimitedAttribute(): bool
    {
        return $this->type === 'limited';
    }

    public function getInStockAttribute(): bool
    {
        if ($this->stock === null) {
            return true;
        }

        return $this->stock_remaining > 0;
    }

    public function getLowestMarketPriceAttribute(): ?int
    {
        return $this->marketListings()
            ->where('status', 'active')
            ->min('price');
    }
}
