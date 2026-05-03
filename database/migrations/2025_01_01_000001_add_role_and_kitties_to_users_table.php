<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->after('email'); // user | moderator | admin
            $table->unsignedBigInteger('kitties')->default(0)->after('role');
            $table->boolean('is_banned')->default(false)->after('kitties');
            $table->timestamp('banned_until')->nullable()->after('is_banned');
            $table->string('avatar_thumbnail')->nullable()->after('banned_until');
            $table->index('role');
            $table->index('is_banned');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'kitties', 'is_banned', 'banned_until', 'avatar_thumbnail']);
        });
    }
};
