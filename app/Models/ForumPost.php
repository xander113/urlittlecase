<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForumPost extends Model
{
    use SoftDeletes;

    protected $fillable = ['thread_id','author_id','body','is_op'];
    protected $casts    = ['is_op' => 'boolean'];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(ForumThread::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->select(['id','name','avatar_thumbnail','role']);
    }
}
