<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,   // admin + mod accounts
            ItemSeeder::class,        // catalog items
            UserSeeder::class,        // 552+ regular users
            MarketplaceSeeder::class, // user inventories + market listings
            TradeSeeder::class,       // trade history
            ForumSeeder::class,       // forum categories + sample threads
        ]);
    }
}
