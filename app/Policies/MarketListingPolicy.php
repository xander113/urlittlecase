<?php

namespace App\Policies;

use App\Models\MarketListing;
use App\Models\User;

class MarketListingPolicy
{
    public function cancel(User $user, MarketListing $listing): bool
    {
        return $user->id === $listing->seller_id && $listing->status === 'active';
    }
}
