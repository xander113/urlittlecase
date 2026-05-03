<?php

namespace App\Policies;

use App\Models\Item;
use App\Models\User;

class ItemPolicy
{
    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'moderator']);
    }

    public function approve(User $user, Item $item): bool
    {
        return in_array($user->role, ['admin', 'moderator']);
    }

    public function update(User $user, Item $item): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, Item $item): bool
    {
        return in_array($user->role, ['admin', 'moderator']);
    }
}
