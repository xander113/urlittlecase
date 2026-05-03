<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\User;
use App\Models\YlcNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class FriendController extends Controller
{
    public function send(string $username, Request $request)
    {
        $target = User::where('name', $username)->firstOrFail();
        $user   = $request->user();

        if ($target->id === $user->id) return back()->with('error', 'You cannot friend yourself.');
        if ($target->is_banned)        return back()->with('error', 'Cannot send request to suspended user.');

        $existing = Friendship::where(function ($q) use ($user, $target) {
            $q->where(['sender_id' => $user->id, 'receiver_id' => $target->id])
              ->orWhere(['sender_id' => $target->id, 'receiver_id' => $user->id]);
        })->first();

        if ($existing) {
            if ($existing->status === 'accepted')        return back()->with('error', 'Already friends.');
            if ($existing->status === 'pending') {
                if ($existing->receiver_id === $user->id) {
                    // Accept incoming request
                    $existing->update(['status' => 'accepted']);
                    YlcNotification::send($target->id, 'friend', "{$user->name} accepted your friend request.", "/users/{$user->name}");
                    return back()->with('success', "You are now friends with {$target->name}!");
                }
                return back()->with('error', 'Friend request already sent.');
            }
        }

        try {
            Friendship::create(['sender_id' => $user->id, 'receiver_id' => $target->id, 'status' => 'pending']);
            YlcNotification::send($target->id, 'friend', "{$user->name} sent you a friend request.", "/users/{$user->name}");
            return back()->with('success', 'Friend request sent!');
        } catch (Throwable $e) {
            Log::error('FriendController::send', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to send friend request.');
        }
    }

    public function unfriend(string $username, Request $request)
    {
        $target = User::where('name', $username)->firstOrFail();
        $user   = $request->user();

        Friendship::where(function ($q) use ($user, $target) {
            $q->where(['sender_id' => $user->id, 'receiver_id' => $target->id])
              ->orWhere(['sender_id' => $target->id, 'receiver_id' => $user->id]);
        })->delete();

        return back()->with('success', "Removed {$target->name} from friends.");
    }
}
