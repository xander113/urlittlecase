<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('price'); // in kitties
            $table->string('status')->default('active'); // active | sold | cancelled
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();

            $table->index(['item_id', 'status', 'price']);
            $table->index(['seller_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_listings');
    }
};
