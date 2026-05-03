<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAction extends Model
{
    protected $fillable = [
        'staff_id', 'action', 'target_user_id', 'target_item_id', 'notes', 'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }
}
