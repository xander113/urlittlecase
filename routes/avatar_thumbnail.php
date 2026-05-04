<?php
/*
|--------------------------------------------------------------------------
| routes/web.php — add this route inside the auth middleware group,
| alongside the existing /avatar/save route.
|--------------------------------------------------------------------------
| Merge only this route into your existing web.php — do not replace the file.
|--------------------------------------------------------------------------
*/

// Inside Route::middleware(['auth', 'ylc.ban'])->group(function () { ...

// Avatar thumbnail regeneration — JSON endpoint called by the browser via
// window.axios (CSRF-safe). The browser NEVER calls /rcc/soap directly.
Route::post('/avatar/thumbnail', [\App\Http\Controllers\AvatarController::class, 'regenerateThumbnail'])
    ->name('avatar.thumbnail')
    ->middleware('throttle:30,1');
