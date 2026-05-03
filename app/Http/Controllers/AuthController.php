<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

use Illuminate\Foundation\Bus\DispatchesJobs;

use Illuminate\Foundation\Validation\ValidatesRequests;

use Illuminate\Support\Facades\Validator;

use Mail;

use Carbon\Carbon;

use Auth;

use Hash;

use Laravel\Fortify\Fortify;

use App\Models\User;

use App\Models\Stream;

use Cache;

use Inertia\Inertia;

use Inertia\Response;

use Redirect;

use Illuminate\Http\Request;

class AuthController extends Controller
{
    
    public function __construct() {
        $this->middleware("auth");
    }
    
    public function index()
    {
        return Inertia::render("Home", [
            'foo' => 'fuck you',
        ]);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return response()->json(["message" => "Success!"], 200);
    }

}
