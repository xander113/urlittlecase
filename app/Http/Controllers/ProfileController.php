<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\User;
use App\Models\UserItem;
use App\Models\YlcNotification;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function show(string $username, Request $request): Response
    {
        $profile = User::where('name', $username)->firstOrFail();

        $inventory = UserItem::where('user_id', $profile->id)
            ->with('item:id,name,thumbnail_url,type,category,color_primary')
            ->latest()
            ->limit(40)
            ->get(['id','item_id','user_id','serial_number','original_price']);

        $friendStatus = $request->user()
            ? Friendship::statusFor($request->user()->id, $profile->id)
            : 'none';

        $profile->friends_count = Friendship::where(function ($q) use ($profile) {
            $q->where('sender_id', $profile->id)->orWhere('receiver_id', $profile->id);
        })->accepted()->count();

        $isSelf = $request->user()?->id === $profile->id;

        return Inertia::render('Profile/Show', [
            'profile'      => $profile->only(['id','name','role','kitties','is_banned','avatar_thumbnail','created_at','friends_count']),
            'inventory'    => $inventory,
            'friendStatus' => $friendStatus,
            'isSelf'       => $isSelf,
        ]);
    }
}
