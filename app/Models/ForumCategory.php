<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\{BelongsTo, HasMany};
use Illuminate\Support\Str;

class ForumCategory extends Model
{
    protected $fillable = [
        'name','slug','description','sort_order','parent_id',
        'is_locked','is_staff_only','threads_count','posts_count',
    ];

    protected $casts = [
        'is_locked'    => 'boolean',
        'is_staff_only'=> 'boolean',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ForumCategory::class, 'parent_id');
    }

    public function subcategories(): HasMany
    {
        return $this->hasMany(ForumCategory::class, 'parent_id')->orderBy('sort_order');
    }

    public function threads(): HasMany
    {
        return $this->hasMany(ForumThread::class, 'category_id');
    }

    public function latestThread()
    {
        return $this->hasOne(ForumThread::class, 'category_id')->latest('last_post_at');
    }

    public static function generateSlug(string $name): string
    {
        return Str::slug($name);
    }

    public function posts()
    {
        return $this->hasManyThrough(
            ForumPost::class, 
            ForumThread::class, 
            'category_id', // Foreign key on the threads table
            'thread_id',   // Foreign key on the posts table
            'id',          // Local key on the categories table
            'id'           // Local key on the threads table
        );
    }
}
