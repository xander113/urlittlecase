<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('pending'); // pending | accepted | declined | cancelled | expired | completed
            $table->unsignedBigInteger('sender_kitties')->default(0);
            $table->unsignedBigInteger('receiver_kitties')->default(0);
            $table->text('sender_note')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['sender_id', 'status']);
            $table->index(['receiver_id', 'status']);
            $table->index('status');
            $table->index('expires_at');
        });

        Schema::create('trade_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trade_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_item_id')->constrained()->cascadeOnDelete();
            $table->string('side'); // sender | receiver
            $table->timestamps();

            $table->index(['trade_id', 'side']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trade_items');
        Schema::dropIfExists('trades');
    }
};
