<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LimitedPriceHistory extends Model
{
    /**
     * Explicit table name — prevents Laravel pluralizing to limited_price_histories.
     */
    protected $table = 'limited_price_history';

    protected $fillable = ['item_id', 'price', 'seller_id', 'buyer_id', 'sold_at'];

    protected $casts = [
        'price'   => 'integer',
        'sold_at' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }
}
