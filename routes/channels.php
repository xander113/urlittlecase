<?php

use Illuminate\Support\Facades\Broadcast;

// User notification channel
Broadcast::channel('notifications.{userId}', fn ($user, $userId) => (int)$user->id === (int)$userId);

// Trade channels (private)
Broadcast::channel('trade.user.{userId}', fn ($user, $userId) => (int)$user->id === (int)$userId);

// Market channels (public)
Broadcast::channel('market.item.{itemId}', fn () => true);
Broadcast::channel('catalog.item.{itemId}', fn () => true);

// Forum channels (public — anyone can subscribe to thread/category updates)
Broadcast::channel('forum.category.{categoryId}', fn () => true);
Broadcast::channel('forum.thread.{threadId}', fn () => true);

// Staff channel
Broadcast::channel('staff', fn ($user) => in_array($user->role, ['moderator','admin']));
