<?php

use App\Jobs\ExpireTrades;
use App\Jobs\PurgeRateLimitHits;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Schedule — YourLittleCase!
|--------------------------------------------------------------------------
| Merge these into your existing routes/console.php schedule block,
| or add them directly to your console.php if it uses the Schedule facade.
|--------------------------------------------------------------------------
*/

// Expire pending trades that have passed their deadline
Schedule::job(new ExpireTrades)->everyFiveMinutes()->withoutOverlapping();

// Purge stale DDoS rate limit records every 10 minutes (no-Redis cleanup)
Schedule::job(new PurgeRateLimitHits)->everyTenMinutes()->withoutOverlapping();
