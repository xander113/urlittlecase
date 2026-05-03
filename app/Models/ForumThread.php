<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany};

class ForumThread extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category_id','author_id','title','slug','is_pinned',
        'is_locked','posts_count','views_count','last_post_at','last_post_author_id',
    ];

    protected $casts = [
        'is_pinned'    => 'boolean',
        'is_locked'    => 'boolean',
        'last_post_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ForumCategory::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->select(['id','name','avatar_thumbnail','role']);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(ForumPost::class, 'thread_id');
    }

    public function originalPost(): HasMany
    {
        return $this->hasMany(ForumPost::class, 'thread_id')->where('is_op', true);
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('deleted_at');
    }
}
