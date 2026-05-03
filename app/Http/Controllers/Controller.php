<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

use Illuminate\Foundation\Validation\ValidatesRequests;

use Illuminate\Foundation\Bus\DispatchesJobs;

use Illuminate\Support\Facades\Validator;

use Mail;

use Carbon\Carbon;

use Auth;

use Hash;

use App\Models\User;

use App\Models\Stream;

use Laravel\Fortify\Fortify;

use Cache;

use Inertia\Inertia;

use Inertia\Response;

use Illuminate\Support\Facades\Route;

use Redirect;

use Illuminate\Http\Request;

use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{

    use AuthorizesRequests, ValidatesRequests;

    //$channel = User::where("name", "ilike", "%".$channel."%")->first(); <- Example of search-like function.

    public function indexfaggot() {
        return Inertia::render("Welcome", [
            'foo' => 'lmao'
        ]);
    }

    public function efof() {
        return Inertia::render("Error", [
            'status' => 404
        ]);
    }

}
