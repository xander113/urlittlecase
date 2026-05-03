<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BanCheck
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->is_banned) {
            // Check if temp ban has expired
            if ($user->banned_until && now()->isAfter($user->banned_until)) {
                $user->update(['is_banned' => false, 'banned_until' => null]);
            } else {
                $message = 'Your account has been suspended.';
                if ($user->banned_until) {
                    $message .= ' Until: ' . $user->banned_until->toFormattedDateString();
                } else {
                    $message .= ' This ban is permanent.';
                }

                if ($request->expectsJson() || $request->is('api/*')) {
                    return response()->json(['message' => $message, 'banned' => true], 403);
                }

                // For Inertia requests, redirect with error
                if ($request->header('X-Inertia')) {
                    return back()->with('error', $message);
                }

                abort(403, $message);
            }
        }

        return $next($request);
    }
}
