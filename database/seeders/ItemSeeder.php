<?php

namespace Database\Seeders;

use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Seeder;

class ItemSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();
        if (!$admin) {
            $this->command->warn('No admin found; skipping ItemSeeder.');
            return;
        }

        $regularItems = [
            ['name' => 'Classic Cap',       'category' => 'hat',       'price' => 25,   'color_primary' => '#e74c3c', 'color_secondary' => '#c0392b'],
            ['name' => 'Simple Tee',        'category' => 'shirt',     'price' => 15,   'color_primary' => '#3498db', 'color_secondary' => '#2980b9'],
            ['name' => 'Denim Jeans',       'category' => 'pants',     'price' => 20,   'color_primary' => '#2c3e50', 'color_secondary' => '#34495e'],
            ['name' => 'Sneakers',          'category' => 'shoes',     'price' => 30,   'color_primary' => '#ffffff', 'color_secondary' => '#bdc3c7'],
            ['name' => 'Shades',            'category' => 'face',      'price' => 18,   'color_primary' => '#1a1a1a', 'color_secondary' => '#808080'],
            ['name' => 'Wristwatch',        'category' => 'accessory', 'price' => 40,   'color_primary' => '#f1c40f', 'color_secondary' => '#f39c12'],
            ['name' => 'Ninja Headband',    'category' => 'hat',       'price' => 35,   'color_primary' => '#27ae60', 'color_secondary' => '#1e8449'],
            ['name' => 'Floral Dress',      'category' => 'shirt',     'price' => 50,   'color_primary' => '#e91e63', 'color_secondary' => '#ad1457'],
            ['name' => 'Cargo Shorts',      'category' => 'pants',     'price' => 22,   'color_primary' => '#795548', 'color_secondary' => '#5d4037'],
            ['name' => 'Boots',             'category' => 'shoes',     'price' => 45,   'color_primary' => '#4a2c17', 'color_secondary' => '#3e2723'],
        ];

        foreach ($regularItems as $data) {
            Item::firstOrCreate(
                ['name' => $data['name']],
                array_merge($data, [
                    'type'        => 'regular',
                    'is_for_sale' => true,
                    'is_approved' => true,
                    'creator_id'  => $admin->id,
                    'description' => "A quality {$data['category']} for your avatar.",
                ])
            );
        }

        $limitedItems = [
            [
                'name'            => 'Golden Crown',
                'category'        => 'hat',
                'price'           => 999,
                'stock'           => 100,
                'stock_remaining' => 100,
                'color_primary'   => '#f1c40f',
                'color_secondary' => '#d4ac0d',
                'description'     => 'A majestic golden crown. Only 100 exist.',
            ],
            [
                'name'            => 'Crimson Mask',
                'category'        => 'face',
                'price'           => 750,
                'stock'           => 50,
                'stock_remaining' => 50,
                'color_primary'   => '#c0392b',
                'color_secondary' => '#922b21',
                'description'     => 'A mysterious crimson mask. Only 50 in existence.',
            ],
            [
                'name'            => 'Midnight Cloak',
                'category'        => 'shirt',
                'price'           => 1500,
                'stock'           => 25,
                'stock_remaining' => 25,
                'color_primary'   => '#1a1a2e',
                'color_secondary' => '#16213e',
                'description'     => 'An ultra-rare midnight cloak. Just 25 made.',
            ],
            [
                'name'            => 'Diamond Boots',
                'category'        => 'shoes',
                'price'           => 2000,
                'stock'           => 10,
                'stock_remaining' => 10,
                'color_primary'   => '#85c1e9',
                'color_secondary' => '#2e86c1',
                'description'     => 'Legendary diamond boots. Only 10 in the world.',
            ],
            [
                'name'            => 'Starlight Chain',
                'category'        => 'accessory',
                'price'           => 500,
                'stock'           => 200,
                'stock_remaining' => 200,
                'color_primary'   => '#d7bde2',
                'color_secondary' => '#a569bd',
                'description'     => 'A glittering starlight chain.',
            ],
        ];

        foreach ($limitedItems as $data) {
            Item::firstOrCreate(
                ['name' => $data['name']],
                array_merge($data, [
                    'type'        => 'limited',
                    'is_for_sale' => true,
                    'is_approved' => true,
                    'creator_id'  => $admin->id,
                ])
            );
        }

        $this->command->info('Catalog items seeded.');
    }
}
