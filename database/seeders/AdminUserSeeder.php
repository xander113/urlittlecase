<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Avatar;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Admin account
        $admin = User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@yourlittlecase.com')],
            [
                'name'              => 'Administrator',
                'password'          => Hash::make(env('ADMIN_PASSWORD', 'changeme123!')),
                'role'              => 'admin',
                'kitties'           => 999_999_999,
                'email_verified_at' => now(),
            ]
        );

        Avatar::firstOrCreate(['user_id' => $admin->id], ['body_color' => '#1a1a1a']);

        // Demo moderator
        $mod = User::firstOrCreate(
            ['email' => 'mod@yourlittlecase.com'],
            [
                'name'              => 'Moderator',
                'password'          => Hash::make('modpassword123!'),
                'role'              => 'moderator',
                'kitties'           => 10_000,
                'email_verified_at' => now(),
            ]
        );

        Avatar::firstOrCreate(['user_id' => $mod->id], ['body_color' => '#4a4a4a']);

        $this->command->info('Admin and Moderator accounts seeded.');
    }
}
