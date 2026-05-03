<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\User;
use App\Models\Trade;
use App\Models\MarketListing;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function index(): Response
    {
        $featuredLimiteds = Item::limited()
            ->forSale()
            ->orderByDesc('rap')
            ->limit(6)
            ->get(['id', 'name', 'thumbnail_url', 'price', 'rap', 'stock', 'stock_remaining', 'color_primary', 'type']);

        $featuredRegular = Item::regular()
            ->forSale()
            ->latest()
            ->limit(6)
            ->get(['id', 'name', 'thumbnail_url', 'price', 'category', 'color_primary', 'type']);

        $stats = [
            'users'    => User::count(),
            'items'    => Item::forSale()->count(),
            'trades'   => Trade::where('status', 'completed')->count(),
            'listings' => MarketListing::active()->count(),
        ];

        return Inertia::render('Home/Index', [
            'featuredLimiteds' => $featuredLimiteds,
            'featuredRegular'  => $featuredRegular,
            'stats'            => $stats,
        ]);
    }
}
