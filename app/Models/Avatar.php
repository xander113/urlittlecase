<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Avatar extends Model
{
    protected $fillable = [
        'user_id',
        'hat_user_item_id', 'face_user_item_id', 'shirt_user_item_id',
        'pants_user_item_id', 'shoes_user_item_id', 'accessory_user_item_id',
        'body_color', 'thumbnail_path',
    ];

    protected $appends = ['equipped'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Return map of slot → user_item_id for convenience.
     */
    public function getEquippedAttribute(): array
    {
        return [
            'hat'       => $this->hat_user_item_id,
            'face'      => $this->face_user_item_id,
            'shirt'     => $this->shirt_user_item_id,
            'pants'     => $this->pants_user_item_id,
            'shoes'     => $this->shoes_user_item_id,
            'accessory' => $this->accessory_user_item_id,
        ];
    }

    public static function slots(): array
    {
        return ['hat', 'face', 'shirt', 'pants', 'shoes', 'accessory'];
    }
}
