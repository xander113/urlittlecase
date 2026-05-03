<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type')->default('regular'); // regular | limited
            $table->string('category')->default('hat'); // hat | face | shirt | pants | shoes | accessory | gear
            $table->unsignedBigInteger('price')->default(0); // in kitties
            $table->unsignedInteger('stock')->nullable(); // null = unlimited (regular); set = limited
            $table->unsignedInteger('stock_remaining')->nullable();
            $table->boolean('is_for_sale')->default(true);
            $table->boolean('is_approved')->default(false);
            $table->string('thumbnail_url')->nullable();
            $table->string('asset_url')->nullable();
            $table->string('color_primary')->default('#ffffff');
            $table->string('color_secondary')->default('#000000');
            $table->unsignedBigInteger('creator_id')->nullable(); // admin who created
            $table->unsignedBigInteger('rap')->default(0); // recent average price
            $table->unsignedBigInteger('rap_sales_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('creator_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['type', 'is_for_sale', 'is_approved']);
            $table->index('category');
            $table->index('rap');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
