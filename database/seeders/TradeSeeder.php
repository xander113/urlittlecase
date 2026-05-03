<?php

namespace Database\Seeders;

use App\Models\Trade;
use App\Models\TradeItem;
use App\Models\UserItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class TradeSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::where('role', 'user')->limit(200)->pluck('id')->toArray();

        if (count($users) < 2) {
            $this->command->warn('Need at least 2 users; skipping TradeSeeder.');
            return;
        }

        $this->command->info('Seeding trades...');
        $created = 0;

        for ($i = 0; $i < 150; $i++) {
            shuffle($users);
            $senderId   = $users[0];
            $receiverId = $users[1];

            // Grab an available item for each side
            $senderItem   = UserItem::where('user_id', $senderId)
                ->where('is_listed', false)->where('in_trade', false)
                ->whereHas('item', fn ($q) => $q->where('type','limited'))
                ->inRandomOrder()->first();
            $receiverItem = UserItem::where('user_id', $receiverId)
                ->where('is_listed', false)->where('in_trade', false)
                ->whereHas('item', fn ($q) => $q->where('type','limited'))
                ->inRandomOrder()->first();

            if (!$senderItem || !$receiverItem) continue;

            $statuses = ['completed','declined','cancelled','expired','pending'];
            $weights  = [40, 20, 15, 15, 10];
            $status   = $this->weightedRandom($statuses, $weights);

            $trade = Trade::create([
                'sender_id'        => $senderId,
                'receiver_id'      => $receiverId,
                'status'           => $status,
                'sender_kitties'   => rand(0, 1) ? rand(10, 500) : 0,
                'receiver_kitties' => rand(0, 1) ? rand(10, 500) : 0,
                'expires_at'       => $status === 'pending' ? now()->addHours(72) : now()->subHours(rand(1, 200)),
            ]);

            TradeItem::create(['trade_id' => $trade->id, 'user_item_id' => $senderItem->id,   'side' => 'sender']);
            TradeItem::create(['trade_id' => $trade->id, 'user_item_id' => $receiverItem->id, 'side' => 'receiver']);

            // If completed, transfer items
            if ($status === 'completed') {
                $senderItem->update(['user_id' => $receiverId]);
                $receiverItem->update(['user_id' => $senderId]);
            }

            $created++;
        }

        $this->command->info("Created {$created} trades.");
    }

    private function weightedRandom(array $items, array $weights): string
    {
        $total = array_sum($weights);
        $rand  = rand(1, $total);
        $cum   = 0;
        foreach ($items as $i => $item) {
            $cum += $weights[$i];
            if ($rand <= $cum) return $item;
        }
        return $items[0];
    }
}
