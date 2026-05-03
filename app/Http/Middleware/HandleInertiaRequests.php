<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
// use Tighten\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        //change to database entries/alert model when dealing with non-static site.
        // danger - ⛔;
        // warning - ⚠️;
        // information - ℹ️;
        $alerts = [
            // ["type" => "warning", "title" => "Under Construction!", "emoji" => "⚠️", "body" => "This site is currently under construction. Everything is subject to change. All images are placeholders."],
            ["type" => "information", "title" => "Important!", "emoji" => "ℹ️", "body" => "Turkey Tom has been found dead during the 9/11 tragedies!"]
        ];

        return array_merge(parent::share($request), [
            'user' => $request->user(),
            'alerts' => $alerts,
            // 'ziggy' => function () use ($request) {
            //     return array_merge((new Ziggy)->toArray(), [
            //         'location' => $request->url(),
            //     ]);
            // },
        ]);

    }
}
