<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KittyTransaction extends Model
{
    protected $fillable = [
        'user_id', 'amount', 'type', 'description',
        'reference_id', 'reference_type', 'balance_after',
    ];

    protected $casts = [
        'amount'       => 'integer',
        'balance_after' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
