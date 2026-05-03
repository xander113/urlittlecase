<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained()->cascadeOnDelete();
            $table->string('serial_number')->nullable()->unique(); // for limiteds
            $table->unsignedBigInteger('original_price')->default(0); // price paid at acquisition
            $table->boolean('is_listed')->default(false); // listed on market
            $table->boolean('in_trade')->default(false); // locked in active trade
            $table->timestamps();

            $table->index(['user_id', 'item_id']);
            $table->index(['user_id', 'is_listed']);
            $table->index(['user_id', 'in_trade']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_items');
    }
};
