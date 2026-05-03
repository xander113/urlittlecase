<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\MarketListing;
use App\Models\User;
use App\Models\UserItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $users   = User::where('role', 'user')->limit(300)->pluck('id')->toArray();
        $limited = Item::where('type', 'limited')->where('is_approved', true)->get();
        $regular = Item::where('type', 'regular')->where('is_approved', true)->get();

        if ($users === [] || $limited->isEmpty()) {
            $this->command->warn('No users or limited items found; run ItemSeeder and UserSeeder first.');
            return;
        }

        $this->command->info('Seeding marketplace...');

        // Give each user 1-4 limited items
        foreach ($users as $userId) {
            $count = rand(0, 4);
            for ($i = 0; $i < $count; $i++) {
                $item = $limited->random();

                // Respect stock
                if ($item->type === 'limited' && $item->stock_remaining !== null && $item->stock_remaining <= 0) {
                    continue;
                }

                $serial = $item->type === 'limited'
                    ? strtoupper(Str::random(8))
                    : null;

                $ui = UserItem::create([
                    'user_id'        => $userId,
                    'item_id'        => $item->id,
                    'serial_number'  => $serial,
                    'original_price' => $item->price,
                ]);

                // Decrement stock
                if ($item->stock_remaining !== null) {
                    Item::where('id', $item->id)->decrement('stock_remaining');
                    $item->stock_remaining = max(0, $item->stock_remaining - 1);
                }

                // 35% chance of listing it
                if (rand(1, 100) <= 35) {
                    $listPrice = (int) round($item->price * (0.8 + lcg_value() * 0.8));
                    $listPrice = max(1, $listPrice);

                    MarketListing::create([
                        'user_item_id' => $ui->id,
                        'seller_id'    => $userId,
                        'item_id'      => $item->id,
                        'price'        => $listPrice,
                        'status'       => 'active',
                    ]);

                    $ui->update(['is_listed' => true]);
                }
            }

            // Give each user 0-6 regular items
            $regCount = rand(0, 6);
            for ($j = 0; $j < $regCount; $j++) {
                $item = $regular->random();
                UserItem::create([
                    'user_id'        => $userId,
                    'item_id'        => $item->id,
                    'original_price' => $item->price,
                ]);
            }
        }

        $this->command->info('Marketplace seeded.');
    }
}
