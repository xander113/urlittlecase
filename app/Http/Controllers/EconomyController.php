<?php

namespace App\Http\Controllers;

use App\Services\EconomyService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EconomyController extends Controller
{
    public function __construct(private EconomyService $economy) {}

    public function index(Request $request): Response
    {
        $user         = $request->user();
        $transactions = $this->economy->history($user, 30);

        return Inertia::render('Economy/Index', [
            'balance'      => $user->kitties,
            'transactions' => $transactions,
        ]);
    }
}
