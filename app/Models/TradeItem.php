<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TradeItem extends Model
{
    protected $fillable = ['trade_id', 'user_item_id', 'side'];

    public function trade(): BelongsTo
    {
        return $this->belongsTo(Trade::class);
    }

    public function userItem(): BelongsTo
    {
        return $this->belongsTo(UserItem::class);
    }
}
