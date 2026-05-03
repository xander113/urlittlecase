<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Token-bucket DDoS protection using the database (no Redis required).
 * Tracks hits per IP (and optionally per user) in rate_limit_hits table.
 */
class DDoSProtection
{
    // Global IP limits (requests per window)
    private const IP_WINDOW_SECONDS = 60;
    private const IP_MAX_HITS       = 200; // 200 req/min per IP
    private const IP_BURST_HITS     = 350; // hard cap before 429

    // Authenticated user limits
    private const USER_WINDOW_SECONDS = 60;
    private const USER_MAX_HITS       = 120;

    // Sensitive endpoint multiplier (e.g. trade/buy routes get stricter)
    private const SENSITIVE_MULTIPLIER = 0.4;

    private array $sensitivePatterns = [
        'trade', 'market/buy', 'market/list', 'economy', 'avatar/save',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // Always skip for internal/CLI
        if (app()->runningInConsole()) {
            return $next($request);
        }

        $ip  = $request->ip() ?? '0.0.0.0';
        $uid = $request->user()?->id;

        $isSensitive = $this->isSensitiveEndpoint($request->path());
        $ipMax       = $isSensitive
            ? (int) (self::IP_MAX_HITS * self::SENSITIVE_MULTIPLIER)
            : self::IP_MAX_HITS;

        // Check IP throttle
        if (!$this->checkAndRecord("ip:{$ip}", self::IP_WINDOW_SECONDS, $ipMax, self::IP_BURST_HITS)) {
            Log::warning('DDoS: IP throttled', ['ip' => $ip, 'path' => $request->path()]);
            return $this->tooManyRequests($request);
        }

        // Check authenticated user throttle
        if ($uid) {
            $userMax = $isSensitive
                ? (int) (self::USER_MAX_HITS * self::SENSITIVE_MULTIPLIER)
                : self::USER_MAX_HITS;

            if (!$this->checkAndRecord("user:{$uid}", self::USER_WINDOW_SECONDS, $userMax, $userMax + 50)) {
                Log::warning('DDoS: User throttled', ['user_id' => $uid, 'path' => $request->path()]);
                return $this->tooManyRequests($request);
            }
        }

        $response = $next($request);

        // Add rate limit headers
        $response->headers->set('X-RateLimit-Limit', (string) $ipMax);

        return $response;
    }

    private function checkAndRecord(string $key, int $windowSeconds, int $maxHits, int $burstCap): bool
    {
        try {
            $windowStart = now()->startOfMinute(); // align to minute boundaries

            return DB::transaction(function () use ($key, $windowStart, $maxHits, $burstCap) {
                // Upsert hit record
                $row = DB::table('rate_limit_hits')
                    ->where('key', $key)
                    ->where('window_start', $windowStart)
                    ->lockForUpdate()
                    ->first();

                if (!$row) {
                    DB::table('rate_limit_hits')->insert([
                        'key'          => $key,
                        'hits'         => 1,
                        'window_start' => $windowStart,
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                    return true;
                }

                if ($row->hits >= $burstCap) {
                    return false;
                }

                DB::table('rate_limit_hits')
                    ->where('key', $key)
                    ->where('window_start', $windowStart)
                    ->update(['hits' => $row->hits + 1, 'updated_at' => now()]);

                return $row->hits + 1 <= $maxHits;
            });
        } catch (Throwable $e) {
            // On DB failure, allow request to avoid false positives
            Log::error('DDoSProtection: DB error', ['error' => $e->getMessage()]);
            return true;
        }
    }

    private function isSensitiveEndpoint(string $path): bool
    {
        foreach ($this->sensitivePatterns as $pattern) {
            if (str_contains($path, $pattern)) {
                return true;
            }
        }
        return false;
    }

    private function tooManyRequests(Request $request): Response
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => 'Too many requests. Please slow down.',
            ], 429)->withHeaders([
                'Retry-After' => self::IP_WINDOW_SECONDS,
            ]);
        }

        return response()->view('errors.429', [], 429);
    }

    /**
     * Purge stale records. Call from a scheduled command.
     */
    public static function cleanup(): void
    {
        try {
            DB::table('rate_limit_hits')
                ->where('window_start', '<', now()->subMinutes(5))
                ->delete();
        } catch (Throwable $e) {
            Log::error('DDoSProtection::cleanup error', ['error' => $e->getMessage()]);
        }
    }
}
