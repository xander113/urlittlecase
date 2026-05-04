<?php

namespace App\Http\Controllers;

use App\Events\ForumPostCreated;
use App\Events\ForumThreadCreated;
use App\Models\ForumCategory;
use App\Models\ForumPost;
use App\Models\ForumThread;
use App\Models\YlcNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ForumController extends Controller
{
    /* ── Index ────────────────────────────────────────────────────────────── */

    public function index(): Response
    {
        /*
         * ForumCategory does NOT have a posts() relationship — posts belong to
         * threads, not categories directly. We use the stored posts_count column
         * instead of ->withCount(['threads','posts']).
         *
         * Bug was: ->withCount(['threads','posts']) on subcategories →
         *   "Call to undefined method App\Models\ForumCategory::posts()"
         */
        $categories = ForumCategory::whereNull('parent_id')
            ->orderBy('sort_order')
            ->with([
                'subcategories' => fn ($q) => $q
                    ->withCount('threads')              // ← only threads, not posts
                    ->with(['latestThread' => fn ($q) => $q
                        ->with('author:id,name')
                        ->select('id','category_id','title','slug','author_id','last_post_at')
                    ])
                    ->orderBy('sort_order'),
            ])
            ->get();

        // Attach posts_count from the stored column (maintained by storeThread/storeReply)
        $categories->each(function ($cat) {
            $cat->subcategories->each(function ($sub) {
                // posts_count is a real column on forum_categories
                $sub->makeVisible('posts_count');
                if ($sub->latestThread) {
                    $sub->latest_thread = [
                        'title'       => $sub->latestThread->title,
                        'slug'        => $sub->latestThread->slug,
                        'author_name' => $sub->latestThread->author?->name,
                        'last_post_at'=> $sub->latestThread->last_post_at,
                    ];
                }
            });
        });

        return Inertia::render('Forum/Index', ['categories' => $categories]);
    }

    /* ── Category (board) ─────────────────────────────────────────────────── */

    public function category(string $slug): Response
    {
        $category = ForumCategory::where('slug', $slug)->firstOrFail();

        $threads = ForumThread::where('category_id', $category->id)
            ->whereNull('deleted_at')
            ->with('author:id,name,avatar_thumbnail,role')
            ->orderByDesc('is_pinned')
            ->orderByDesc('last_post_at')
            ->paginate(25);

        return Inertia::render('Forum/Category', compact('category', 'threads'));
    }

    /* ── Thread (show) ────────────────────────────────────────────────────── */

    public function thread(string $catSlug, string $threadSlug, Request $request): Response
    {
        $category = ForumCategory::where('slug', $catSlug)->firstOrFail();
        $thread   = ForumThread::where('category_id', $category->id)
            ->where('slug', $threadSlug)
            ->firstOrFail();

        ForumThread::where('id', $thread->id)->increment('views_count');

        $posts = ForumPost::where('thread_id', $thread->id)
            ->whereNull('deleted_at')
            ->with('author:id,name,avatar_thumbnail,role')
            ->orderBy('created_at')
            ->paginate(20);

        // Attach per-author post count without withCount (avoids sub-query explosion)
        $authorIds    = $posts->getCollection()->pluck('author_id')->unique()->filter()->values();
        $postCounts   = ForumPost::whereIn('author_id', $authorIds)
            ->selectRaw('author_id, count(*) as cnt')
            ->groupBy('author_id')
            ->pluck('cnt', 'author_id');

        $posts->getCollection()->transform(function ($post) use ($postCounts) {
            if ($post->author) {
                $post->author->posts_count = $postCounts[$post->author_id] ?? 0;
            }
            return $post;
        });

        return Inertia::render('Forum/Thread', compact('thread', 'posts', 'category'));
    }

    /* ── Create thread form ───────────────────────────────────────────────── */

    public function createForm(?string $catSlug = null): Response
    {
        $user = request()->user();

        $categories = ForumCategory::whereNull('parent_id')
            ->orderBy('sort_order')
            ->with([
                'subcategories' => fn ($q) => $q
                    ->orderBy('sort_order')
                    ->select('id','name','slug','parent_id','is_locked','is_staff_only'),
            ])
            ->get(['id','name','slug']);

        // Filter staff-only boards for regular users
        $categories->each(function ($cat) use ($user) {
            $cat->subcategories = $cat->subcategories->filter(function ($sub) use ($user) {
                return !$sub->is_staff_only || in_array($user?->role, ['moderator','admin']);
            })->values();
        });

        $preselected = $catSlug ? ForumCategory::where('slug', $catSlug)->first() : null;

        return Inertia::render('Forum/Create', compact('categories', 'preselected'));
    }

    /* ── Store thread ─────────────────────────────────────────────────────── */

    public function storeThread(string $catSlug, Request $request)
    {
        $category = ForumCategory::where('slug', $catSlug)->firstOrFail();
        $user     = $request->user();

        if ($category->is_locked) return back()->with('error', 'This board is locked.');
        if ($category->is_staff_only && !in_array($user->role, ['moderator','admin'])) {
            return back()->with('error', 'Only staff can post here.');
        }

        $validated = $request->validate([
            'title' => 'required|string|min:3|max:150',
            'body'  => 'required|string|min:5|max:20000',
        ]);

        try {
            $threadId = null;
            DB::transaction(function () use ($category, $user, $validated, &$threadId) {
                $slug = $this->uniqueSlug($validated['title'], $category->id);

                $thread = ForumThread::create([
                    'category_id'         => $category->id,
                    'author_id'           => $user->id,
                    'title'               => $validated['title'],
                    'slug'                => $slug,
                    'last_post_at'        => now(),
                    'last_post_author_id' => $user->id,
                ]);

                ForumPost::create([
                    'thread_id' => $thread->id,
                    'author_id' => $user->id,
                    'body'      => $validated['body'],
                    'is_op'     => true,
                ]);

                $category->increment('threads_count');
                $category->increment('posts_count');

                broadcast(new ForumThreadCreated($thread, $category))->toOthers();
                $threadId = $thread->id;
            });

            return redirect("/forum/{$catSlug}")->with('success', 'Thread posted!');
        } catch (Throwable $e) {
            Log::error('ForumController::storeThread', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to post thread. Please try again.');
        }
    }

    /* ── Store reply ──────────────────────────────────────────────────────── */

    public function storeReply(string $catSlug, string $threadSlug, Request $request)
    {
        $category = ForumCategory::where('slug', $catSlug)->firstOrFail();
        $thread   = ForumThread::where('category_id', $category->id)
            ->where('slug', $threadSlug)
            ->firstOrFail();
        $user     = $request->user();

        if ($thread->is_locked) return back()->with('error', 'This thread is locked.');

        $validated = $request->validate(['body' => 'required|string|min:1|max:20000']);

        try {
            DB::transaction(function () use ($thread, $category, $user, $validated) {
                $post = ForumPost::create([
                    'thread_id' => $thread->id,
                    'author_id' => $user->id,
                    'body'      => $validated['body'],
                    'is_op'     => false,
                ]);

                $thread->increment('posts_count');
                $thread->update(['last_post_at' => now(), 'last_post_author_id' => $user->id]);
                $category->increment('posts_count');

                broadcast(new ForumPostCreated($post, $thread))->toOthers();

                if ($thread->author_id !== $user->id) {
                    YlcNotification::send(
                        $thread->author_id, 'forum',
                        "{$user->name} replied to your thread: {$thread->title}",
                        "/forum/{$category->slug}/{$thread->slug}"
                    );
                }
            });

            return back()->with('success', 'Reply posted!');
        } catch (Throwable $e) {
            Log::error('ForumController::storeReply', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to post reply.');
        }
    }

    /* ── Delete post ──────────────────────────────────────────────────────── */

    public function deletePost(ForumPost $post, Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, ['moderator','admin']) && $user->id !== $post->author_id) {
            return back()->with('error', 'Unauthorized.');
        }

        DB::transaction(function () use ($post) {
            $post->delete();
            ForumThread::where('id', $post->thread_id)->decrement('posts_count');
            $cat = ForumThread::find($post->thread_id)?->category;
            $cat?->decrement('posts_count');
        });

        return back()->with('success', 'Post deleted.');
    }

    /* ── Pin / Lock ───────────────────────────────────────────────────────── */

    public function pin(string $catSlug, string $threadSlug, Request $request)
    {
        $this->requireStaff($request);
        $thread = $this->findThread($catSlug, $threadSlug);
        $thread->update(['is_pinned' => !$thread->is_pinned]);
        return back()->with('success', $thread->is_pinned ? 'Thread pinned.' : 'Thread unpinned.');
    }

    public function lock(string $catSlug, string $threadSlug, Request $request)
    {
        $this->requireStaff($request);
        $thread = $this->findThread($catSlug, $threadSlug);
        $thread->update(['is_locked' => !$thread->is_locked]);
        return back()->with('success', $thread->is_locked ? 'Thread locked.' : 'Thread unlocked.');
    }

    /* ── Helpers ──────────────────────────────────────────────────────────── */

    private function findThread(string $catSlug, string $threadSlug): ForumThread
    {
        $cat = ForumCategory::where('slug', $catSlug)->firstOrFail();
        return ForumThread::where('category_id', $cat->id)
            ->where('slug', $threadSlug)
            ->firstOrFail();
    }

    private function requireStaff(Request $request): void
    {
        if (!in_array($request->user()?->role, ['moderator','admin'])) abort(403);
    }

    private function uniqueSlug(string $title, int $categoryId): string
    {
        $base = Str::slug($title) ?: 'thread';
        $slug = $base;
        $n    = 1;
        while (ForumThread::where('category_id', $categoryId)->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }
        return $slug;
    }
}
