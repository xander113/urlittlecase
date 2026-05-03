<?php

namespace App\Http\Controllers;

use App\Models\YlcNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifs = YlcNotification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate(30);

        return response()->json($notifs);
    }

    public function markRead(Request $request)
    {
        YlcNotification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }

    public function dismiss(YlcNotification $notification, Request $request)
    {
        if ($notification->user_id !== $request->user()->id) abort(403);
        $notification->delete();
        return response()->json(['ok' => true]);
    }

    public function unreadCount(Request $request)
    {
        $count = YlcNotification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count();
        return response()->json(['count' => $count]);
    }
}
