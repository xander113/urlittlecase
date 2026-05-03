<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Forum categories (boards) ──────────────────────────────────────
        Schema::create('forum_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('parent_id')->nullable(); // null = top-level group
            $table->boolean('is_locked')->default(false);
            $table->boolean('is_staff_only')->default(false);
            $table->unsignedBigInteger('threads_count')->default(0);
            $table->unsignedBigInteger('posts_count')->default(0);
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('forum_categories')->nullOnDelete();
            $table->index(['parent_id', 'sort_order']);
        });

        // ── Forum threads ──────────────────────────────────────────────────
        Schema::create('forum_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('forum_categories')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_locked')->default(false);
            $table->unsignedBigInteger('posts_count')->default(0);
            $table->unsignedBigInteger('views_count')->default(0);
            $table->timestamp('last_post_at')->nullable();
            $table->unsignedBigInteger('last_post_author_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['category_id', 'slug']);
            $table->index(['category_id', 'is_pinned', 'last_post_at']);
            $table->index('author_id');
        });

        // ── Forum posts (OP + replies) ─────────────────────────────────────
        Schema::create('forum_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('forum_threads')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('is_op')->default(false); // original post
            $table->timestamps();
            $table->softDeletes();

            $table->index(['thread_id', 'created_at']);
            $table->index('author_id');
        });

        // ── Friendships ───────────────────────────────────────────────────
        Schema::create('friendships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('pending'); // pending | accepted | declined | blocked
            $table->timestamps();

            $table->unique(['sender_id', 'receiver_id']);
            $table->index(['receiver_id', 'status']);
            $table->index(['sender_id', 'status']);
        });

        // ── Notifications ─────────────────────────────────────────────────
        Schema::create('ylc_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');   // trade | friend | market | system | forum
            $table->string('message');
            $table->json('data')->nullable();
            $table->string('link')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'is_read', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ylc_notifications');
        Schema::dropIfExists('friendships');
        Schema::dropIfExists('forum_posts');
        Schema::dropIfExists('forum_threads');
        Schema::dropIfExists('forum_categories');
    }
};
