<?php

namespace Database\Seeders;

use App\Models\ForumCategory;
use App\Models\ForumPost;
use App\Models\ForumThread;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ForumSeeder extends Seeder
{
    private static array $STRUCTURE = [
        ['name' => 'General',     'desc' => 'General discussion and announcements.', 'boards' => [
            ['name' => 'Announcements',  'desc' => 'Official site news and updates.',       'staff_only' => true],
            ['name' => 'General Chat',   'desc' => 'Talk about anything YourLittleCase!'],
            ['name' => 'Introductions',  'desc' => 'Introduce yourself to the community.'],
        ]],
        ['name' => 'Economy',     'desc' => 'Trading, market, and item discussion.', 'boards' => [
            ['name' => 'Item Discussion', 'desc' => 'Discuss catalog items and limiteds.'],
            ['name' => 'Trade Requests',  'desc' => 'Post your trade offers here.'],
            ['name' => 'Market Talk',     'desc' => 'Market prices and investment tips.'],
        ]],
        ['name' => 'Help & Support', 'desc' => 'Get help from the community.', 'boards' => [
            ['name' => 'Help & Questions', 'desc' => 'Ask questions here.'],
            ['name' => 'Bug Reports',      'desc' => 'Report bugs and issues.'],
        ]],
        ['name' => 'Off-Topic',   'desc' => 'Not related to YourLittleCase!', 'boards' => [
            ['name' => 'Off-Topic',   'desc' => 'Anything goes (within rules).'],
            ['name' => 'Creativity',  'desc' => 'Show off your art and projects.'],
        ]],
        ['name' => 'Staff',       'desc' => 'Staff-only discussion.', 'boards' => [
            ['name' => 'Staff Lounge', 'desc' => 'Staff only.', 'staff_only' => true],
        ]],
    ];

    private static array $SAMPLE_THREADS = [
        ['title' => 'Welcome to the forum!', 'body' => 'Welcome to YourLittleCase! Please read the rules before posting.', 'pinned' => true],
        ['title' => 'Trading tips for beginners', 'body' => 'Here are some tips for new traders: always check the RAP before accepting a trade...'],
        ['title' => 'Limited item price guide', 'body' => 'A comprehensive guide to limited item pricing. Updated weekly.'],
        ['title' => 'What limiteds do you own?', 'body' => 'Share your limited item collection in this thread!'],
        ['title' => 'Best way to earn Kitties?', 'body' => 'What is the fastest way to earn Kitties? I have been buying and selling limiteds.'],
        ['title' => 'Avatar showcase thread', 'body' => 'Post your avatar here and let others rate it!'],
        ['title' => 'Bug report: market listing issue', 'body' => 'When I try to list an item, the price resets to 0. Anyone else having this?'],
        ['title' => 'How does RAP work?', 'body' => 'Can someone explain how the Recent Average Price is calculated?'],
        ['title' => 'Off-topic chat thread', 'body' => 'Talk about anything here! Games, movies, music — whatever.'],
        ['title' => 'Introduce yourself!', 'body' => 'New to the site? Drop a quick intro here and say hi!'],
    ];

    private static array $SAMPLE_REPLIES = [
        'Great thread, thanks for posting!',
        'I agree with this completely.',
        'Interesting perspective. I think the market will stabilize soon.',
        'Has anyone else noticed prices going up lately?',
        'Thanks for the tips! Very helpful for a new player.',
        'I disagree - the value really depends on the item.',
        'Good point. I hadn\'t thought about it that way.',
        'Welcome to the community!',
        'Could you elaborate on this a bit more?',
        'This is exactly what I was looking for, thank you!',
        'I\'ve been trading for months and this matches my experience.',
        'Bump! This thread deserves more attention.',
        'Can you share more details about your collection?',
        'Agreed. The economy seems healthy right now.',
        'Has the staff commented on this yet?',
    ];

    public function run(): void
    {
        $users = User::where('role', 'user')->limit(100)->pluck('id')->toArray();
        $admin = User::where('role', 'admin')->first();

        if (!$admin) { $this->command->warn('No admin; skipping ForumSeeder.'); return; }
        if (empty($users)) { $this->command->warn('No users; run UserSeeder first.'); return; }

        $this->command->info('Seeding forum...');

        foreach (self::$STRUCTURE as $sort => $groupDef) {
            $group = ForumCategory::firstOrCreate(
                ['slug' => Str::slug($groupDef['name'])],
                [
                    'name'        => $groupDef['name'],
                    'description' => $groupDef['desc'] ?? null,
                    'sort_order'  => $sort,
                    'parent_id'   => null,
                ]
            );

            foreach ($groupDef['boards'] as $bSort => $boardDef) {
                $board = ForumCategory::firstOrCreate(
                    ['slug' => Str::slug($boardDef['name'])],
                    [
                        'name'           => $boardDef['name'],
                        'description'    => $boardDef['desc'] ?? null,
                        'sort_order'     => $bSort,
                        'parent_id'      => $group->id,
                        'is_staff_only'  => $boardDef['staff_only'] ?? false,
                    ]
                );

                // Seed sample threads into each board
                $threadSamples = array_slice(
                    array_merge(
                        array_fill(0, 2, array_rand(self::$SAMPLE_THREADS)),
                        [0] // ensure at least first thread
                    ),
                    0, rand(2, 5)
                );

                foreach ($threadSamples as $ti) {
                    $td        = self::$SAMPLE_THREADS[$ti % count(self::$SAMPLE_THREADS)];
                    $authorId  = $board->is_staff_only ? $admin->id : $users[array_rand($users)];
                    $baseSlug  = Str::slug($td['title']);
                    $slug      = $baseSlug;
                    $n         = 1;
                    while (ForumThread::where('category_id', $board->id)->where('slug', $slug)->exists()) {
                        $slug = "{$baseSlug}-{$n}";
                        $n++;
                    }

                    $thread = ForumThread::firstOrCreate(
                        ['category_id' => $board->id, 'slug' => $slug],
                        [
                            'author_id'    => $authorId,
                            'title'        => $td['title'],
                            'is_pinned'    => $td['pinned'] ?? false,
                            'last_post_at' => now()->subHours(rand(0, 720)),
                        ]
                    );

                    if (ForumPost::where('thread_id', $thread->id)->where('is_op', true)->doesntExist()) {
                        ForumPost::create([
                            'thread_id' => $thread->id,
                            'author_id' => $authorId,
                            'body'      => $td['body'],
                            'is_op'     => true,
                            'created_at'=> $thread->created_at,
                        ]);

                        // 3-8 replies
                        $replyCount = rand(3, 8);
                        for ($r = 0; $r < $replyCount; $r++) {
                            ForumPost::create([
                                'thread_id'  => $thread->id,
                                'author_id'  => $users[array_rand($users)],
                                'body'       => self::$SAMPLE_REPLIES[array_rand(self::$SAMPLE_REPLIES)],
                                'is_op'      => false,
                                'created_at' => now()->subHours(rand(0, 700)),
                            ]);
                        }

                        $posts = ForumPost::where('thread_id', $thread->id)->count();
                        $thread->update(['posts_count' => $posts, 'last_post_at' => now()->subHours(rand(0, 48))]);
                        $board->increment('threads_count');
                        $board->increment('posts_count', $posts);
                    }
                }
            }
        }

        $this->command->info('Forum seeded.');
    }
}
