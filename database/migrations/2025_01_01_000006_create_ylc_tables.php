<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Avatar configuration per user
        Schema::create('avatars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('hat_user_item_id')->nullable();
            $table->unsignedBigInteger('face_user_item_id')->nullable();
            $table->unsignedBigInteger('shirt_user_item_id')->nullable();
            $table->unsignedBigInteger('pants_user_item_id')->nullable();
            $table->unsignedBigInteger('shoes_user_item_id')->nullable();
            $table->unsignedBigInteger('accessory_user_item_id')->nullable();
            $table->string('body_color')->default('#f5cba7');
            $table->string('thumbnail_path')->nullable();
            $table->timestamps();
        });

        // All currency movements
        Schema::create('kitty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount'); // positive = credit, negative = debit
            $table->string('type'); // purchase | sale | trade | grant | admin_grant | admin_deduct | refund
            $table->string('description');
            $table->unsignedBigInteger('reference_id')->nullable(); // item_id, trade_id, listing_id
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('balance_after');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('type');
        });

        // Per-sale price record for RAP calculation
        Schema::create('limited_price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('price');
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('sold_at');
            $table->timestamps();

            $table->index(['item_id', 'sold_at']);
        });

        // User bans
        Schema::create('bans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('users')->cascadeOnDelete();
            $table->text('reason');
            $table->timestamp('expires_at')->nullable(); // null = permanent
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
        });

        // User-submitted reports
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reported_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('reported_item_id')->nullable();
            $table->string('reason');
            $table->text('details')->nullable();
            $table->string('status')->default('open'); // open | reviewed | dismissed
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('reporter_id');
            $table->index('reported_user_id');
        });

        // Staff action log
        Schema::create('staff_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('users')->cascadeOnDelete();
            $table->string('action'); // ban | unban | item_remove | item_approve | grant_kitties | deduct_kitties | grant_item
            $table->unsignedBigInteger('target_user_id')->nullable();
            $table->unsignedBigInteger('target_item_id')->nullable();
            $table->text('notes')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['staff_id', 'created_at']);
            $table->index('action');
        });

        // DDoS / rate limit tracking (no Redis)
        Schema::create('rate_limit_hits', function (Blueprint $table) {
            $table->id();
            $table->string('key')->index(); // ip_address or user_id
            $table->string('endpoint')->nullable();
            $table->unsignedInteger('hits')->default(1);
            $table->timestamp('window_start');
            $table->timestamps();

            $table->unique(['key', 'endpoint', 'window_start']);
            $table->index(['key', 'window_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_limit_hits');
        Schema::dropIfExists('staff_actions');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('bans');
        Schema::dropIfExists('limited_price_history');
        Schema::dropIfExists('kitty_transactions');
        Schema::dropIfExists('avatars');
    }
};
