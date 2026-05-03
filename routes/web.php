<?php

use App\Http\Controllers\AvatarController;
use App\Http\Controllers\EconomyController;
use App\Http\Controllers\ForumController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\MarketController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RCCController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\TradeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| YourLittleCase! — Full Route File (replace existing routes/web.php content)
|--------------------------------------------------------------------------
*/

// Landing
Route::get('/', [HomeController::class, 'index'])->name('home');

// RCC
Route::get('/rcc/wsdl', [RCCController::class, 'wsdl'])->name('rcc.wsdl');
Route::post('/rcc/soap', [RCCController::class, 'handle'])->name('rcc.soap')->middleware('throttle:30,1');

// Public catalog
Route::get('/catalog',        [ItemController::class, 'index'])->name('catalog.index');
Route::get('/catalog/{item}', [ItemController::class, 'show']) ->name('catalog.show')->whereNumber('item');

// Public profiles
Route::get('/users/{username}', [ProfileController::class, 'show'])->name('profile.show');

// Forum (public read)
Route::get('/forum',                                    [ForumController::class, 'index'])       ->name('forum.index');
Route::get('/forum/create',                             [ForumController::class, 'createForm'])   ->name('forum.create.global')->middleware('auth');
Route::get('/forum/{category}',                         [ForumController::class, 'category'])    ->name('forum.category');
Route::get('/forum/{category}/create',                  [ForumController::class, 'createForm'])   ->name('forum.create')->middleware('auth');
Route::get('/forum/{category}/{thread}',                [ForumController::class, 'thread'])      ->name('forum.thread');

// Authenticated
Route::middleware(['auth', 'ylc.ban'])->group(function () {

    // Catalog purchase
    Route::post('/catalog/{item}/purchase', [ItemController::class, 'purchase'])
        ->name('catalog.purchase')->whereNumber('item')->middleware('throttle:10,1');

    // Economy
    Route::get('/economy', [EconomyController::class, 'index'])->name('economy.index');

    // Market
    Route::get('/market',                   [MarketController::class, 'index']) ->name('market.index');
    Route::post('/market/list',             [MarketController::class, 'list'])  ->name('market.list') ->middleware('throttle:15,1');
    Route::post('/market/{listing}/buy',    [MarketController::class, 'buy'])   ->name('market.buy')  ->whereNumber('listing')->middleware('throttle:10,1');
    Route::post('/market/{listing}/cancel', [MarketController::class, 'cancel'])->name('market.cancel')->whereNumber('listing');

    // Trades — create BEFORE {trade}
    Route::get('/trade',                         [TradeController::class, 'index'])      ->name('trade.index');
    Route::get('/trade/create',                  [TradeController::class, 'createPage']) ->name('trade.create');
    Route::post('/trade',                        [TradeController::class, 'create'])     ->name('trade.store')->middleware('throttle:5,1');
    Route::get('/trade/{trade}',                 [TradeController::class, 'show'])       ->name('trade.show')   ->whereNumber('trade');
    Route::post('/trade/{trade}/accept',         [TradeController::class, 'accept'])     ->name('trade.accept') ->whereNumber('trade')->middleware('throttle:10,1');
    Route::post('/trade/{trade}/decline',        [TradeController::class, 'decline'])    ->name('trade.decline')->whereNumber('trade');
    Route::post('/trade/{trade}/cancel',         [TradeController::class, 'cancel'])     ->name('trade.cancel') ->whereNumber('trade');

    // Avatar
    Route::get('/avatar',        [AvatarController::class, 'index'])->name('avatar.index');
    Route::post('/avatar/save',  [AvatarController::class, 'save']) ->name('avatar.save')->middleware('throttle:20,1');

    // Reports
    Route::post('/report', [ReportController::class, 'store'])->name('report.store')->middleware('throttle:3,1');

    // Friends
    Route::post('/users/{username}/friend',  [FriendController::class, 'send'])    ->name('friend.send');
    Route::post('/users/{username}/unfriend',[FriendController::class, 'unfriend'])->name('friend.remove');

    // Forum (write)
    Route::post('/forum/{category}/threads',         [ForumController::class, 'storeThread']) ->name('forum.thread.store')->middleware('throttle:5,1');
    Route::post('/forum/{category}/{thread}/reply',  [ForumController::class, 'storeReply'])  ->name('forum.post.store') ->middleware('throttle:10,1');
    Route::delete('/forum/posts/{post}',             [ForumController::class, 'deletePost'])  ->name('forum.post.delete')->whereNumber('post');
    Route::post('/forum/{category}/{thread}/pin',    [ForumController::class, 'pin'])         ->name('forum.thread.pin');
    Route::post('/forum/{category}/{thread}/lock',   [ForumController::class, 'lock'])        ->name('forum.thread.lock');

    // Notifications (JSON API)
    Route::get('/notifications',          [NotificationController::class, 'index'])     ->name('notifications.index');
    Route::post('/notifications/read',    [NotificationController::class, 'markRead'])  ->name('notifications.read');
    Route::delete('/notifications/{n}',   [NotificationController::class, 'dismiss'])   ->name('notifications.dismiss')->whereNumber('n');
    Route::get('/notifications/unread',   [NotificationController::class, 'unreadCount'])->name('notifications.unread');

    // Staff Panel
    Route::middleware('staff')->prefix('staff')->name('staff.')->group(function () {
        Route::get('/',                              [\App\Http\Controllers\StaffController::class, 'index'])        ->name('index');
        Route::get('/reports',                       [\App\Http\Controllers\StaffController::class, 'reports'])       ->name('reports');
        Route::post('/reports/{report}/dismiss',     [\App\Http\Controllers\StaffController::class, 'dismissReport']) ->name('reports.dismiss')->whereNumber('report');
        Route::get('/bans',                          [\App\Http\Controllers\StaffController::class, 'bans'])          ->name('bans');
        Route::post('/bans/ban',                     [\App\Http\Controllers\StaffController::class, 'banUser'])       ->name('ban');
        Route::post('/bans/unban',                   [\App\Http\Controllers\StaffController::class, 'unbanUser'])     ->name('unban');
        Route::get('/items',                         [\App\Http\Controllers\StaffController::class, 'items'])         ->name('items');
        Route::post('/items/{item}/approve',         [\App\Http\Controllers\StaffController::class, 'approveItem'])   ->name('items.approve')->whereNumber('item');
        Route::post('/items/{item}/remove',          [\App\Http\Controllers\StaffController::class, 'removeItem'])    ->name('items.remove')->whereNumber('item');
        Route::get('/users/search',                  [\App\Http\Controllers\StaffController::class, 'searchUsers'])   ->name('users.search');

        Route::middleware('admin')->group(function () {
            Route::post('/economy/grant-kitties',    [\App\Http\Controllers\StaffController::class, 'grantKitties']) ->name('economy.grant');
            Route::post('/economy/grant-item',       [\App\Http\Controllers\StaffController::class, 'grantItem'])    ->name('economy.grant-item');
            Route::post('/catalog',                  [ItemController::class, 'store'])                               ->name('catalog.create');
        });
    });
});

// Route::get('/about-us', [App\Http\Controllers\Controller::class, 'about']);

// Route::get('/contact', [App\Http\Controllers\Controller::class, 'contact']);

Route::get('/home', [App\Http\Controllers\AuthController::class, 'index'])->name("home");

Route::get('/login', [App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'create'])->name("login");

Route::get('/register', [App\Http\Controllers\Auth\RegisteredUserController::class, 'create'])->name("register");

Route::post('/auth/login', [App\Http\Controllers\SessionController::class, 'loginRequest'])->name("loginRequest");

Route::post('/auth/register', [App\Http\Controllers\SessionController::class, 'registerRequest'])->name("registerRequest");

Route::get('/api/logout', [App\Http\Controllers\AuthController::class, 'logout'])->name("logoutRequest");

// 404 error || KEEP AT BOTTOM!!

Route::any('{catchall}', [App\Http\Controllers\Controller::class, 'efof'])->where('catchall', '.*');