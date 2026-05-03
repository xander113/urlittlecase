<?php

namespace App\Policies;

use App\Models\Trade;
use App\Models\User;

class TradePolicy
{
    public function view(User $user, Trade $trade): bool
    {
        return $user->id === $trade->sender_id || $user->id === $trade->receiver_id;
    }

    public function accept(User $user, Trade $trade): bool
    {
        return $user->id === $trade->receiver_id && $trade->status === 'pending';
    }

    public function cancel(User $user, Trade $trade): bool
    {
        return $user->id === $trade->sender_id && $trade->status === 'pending';
    }
}
