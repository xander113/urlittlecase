<?php

namespace Database\Seeders;

use App\Models\Avatar;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    private static array $adjectives = [
        'Crimson','Azure','Golden','Silver','Shadow','Neon','Frost','Ember',
        'Storm','Mystic','Rapid','Silent','Iron','Cobalt','Viridian','Obsidian',
        'Amber','Violet','Scarlet','Teal','Sage','Ivory','Onyx','Pearl',
        'Phantom','Vivid','Swift','Calm','Bold','Sharp','Dark','Bright',
        'Wild','Lone','Lost','Free','Raw','Pure','Grand','Noble',
        'Cool','Warm','Soft','Hard','Keen','Vast','Deep','Wide',
    ];

    private static array $nouns = [
        'Fox','Tiger','Raven','Wolf','Bear','Eagle','Hawk','Dragon',
        'Knight','Wizard','Scout','Hunter','Guard','Ranger','Pilot','Captain',
        'Blade','Shield','Arrow','Staff','Gem','Crown','Mask','Cloak',
        'Spark','Flame','Wave','Wind','Tide','Rock','Stone','Peak',
        'City','Tower','Gate','Bridge','River','Lake','Coast','Valley',
        'Star','Moon','Sun','Comet','Nova','Pulsar','Orbit','Cosmos',
        'Loop','Core','Edge','Node','Grid','Flux','Pulse','Beam',
    ];

    public function run(): void
    {
        $used  = [];
        $count = 0;
        $target = 552;

        // Ensure admin + mod exist (handled by AdminUserSeeder but guard here)
        $adminEmail = env('ADMIN_EMAIL', 'admin@yourlittlecase.com');
        $admin      = User::firstOrCreate(['email' => $adminEmail], [
            'name'              => 'Administrator',
            'password'          => Hash::make(env('ADMIN_PASSWORD', 'changeme123!')),
            'role'              => 'admin',
            'kitties'           => 999_999_999,
            'email_verified_at' => now(),
        ]);
        Avatar::firstOrCreate(['user_id' => $admin->id], ['body_color' => '#111111']);

        $this->command->info("Seeding {$target} users...");
        $bar = $this->command->getOutput()->createProgressBar($target);
        $bar->start();

        for ($i = 0; $i < $target * 4 && $count < $target; $i++) {
            $adj  = self::$adjectives[array_rand(self::$adjectives)];
            $noun = self::$nouns[array_rand(self::$nouns)];
            $num  = rand(1, 9999);
            $name = "{$adj}{$noun}{$num}";

            if (in_array($name, $used)) continue;
            $used[] = $name;

            $email = strtolower("{$adj}.{$noun}.{$num}@example.com");

            if (User::where('email', $email)->exists()) continue;

            $user = User::create([
                'name'              => $name,
                'email'             => $email,
                'password'          => Hash::make('password'),
                'role'              => 'user',
                'kitties'           => rand(0, 50_000),
                'email_verified_at' => now(),
            ]);

            Avatar::create([
                'user_id'    => $user->id,
                'body_color' => sprintf('#%06x', mt_rand(0, 0xFFFFFF)),
            ]);

            $count++;
            $bar->advance();
        }

        $bar->finish();
        $this->command->newLine();
        $this->command->info("Seeded {$count} users.");
    }
}
