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

use Laravel\Fortify\Fortify;

use Cache;

use Inertia\Inertia;

use Inertia\Response;

use App\Models\User;

use App\Models\Stream;

use Illuminate\Support\Facades\Route;

use Redirect;

use Illuminate\Http\Request;

class SessionController extends Controller
{

    public function __construct() {
        $this->middleware("guest");
    }
    
    public function loginRequest(Request $request)
    {

        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if ($validator->fails()) {
            return response()->json($validator->messages(), 400);
        }

        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (Auth::attempt($credentials)) {
            return response()->json(["message" => "Success!"], 200);
        }else{
            return response()->json(["message" => "Sorry, those credentials don't match our records!"], 400);
        }

    }

    public function registerRequest(Request $request)
    {

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'unique:users', 'regex:/^[a-zA-Z0-9_-]{3,25}$/'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json(["message" => $validator->messages()->first()], 400);
        }

        $user = new User;
        $user->name = $request->input('name');
        $user->email = $request->input('email');
        $user->password = Hash::make($request->input('password'));
        $user->save();

        return response()->json(["message" => "Success!"], 200);

    }

}
