<?php

namespace App\Services;

use App\Models\User;
use App\Models\KittyTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class EconomyService
{
    /**
     * Grant kitties to a user. Returns false on failure.
     */
    public function grant(User $user, int $amount, string $type, string $description, ?int $referenceId = null, ?string $referenceType = null): bool
    {
        if ($amount <= 0) {
            return false;
        }

        try {
            DB::transaction(function () use ($user, $amount, $type, $description, $referenceId, $referenceType) {
                // Lock the row for update to prevent race conditions
                $fresh = User::lockForUpdate()->findOrFail($user->id);
                $fresh->kitties += $amount;
                $fresh->save();

                KittyTransaction::create([
                    'user_id'        => $fresh->id,
                    'amount'         => $amount,
                    'type'           => $type,
                    'description'    => $description,
                    'reference_id'   => $referenceId,
                    'reference_type' => $referenceType,
                    'balance_after'  => $fresh->kitties,
                ]);

                $user->kitties = $fresh->kitties;
            });

            return true;
        } catch (Throwable $e) {
            Log::error('EconomyService::grant failed', ['user_id' => $user->id, 'amount' => $amount, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Deduct kitties from a user. Returns false if insufficient funds or error.
     */
    public function deduct(User $user, int $amount, string $type, string $description, ?int $referenceId = null, ?string $referenceType = null): bool
    {
        if ($amount <= 0) {
            return false;
        }

        try {
            $success = false;

            DB::transaction(function () use ($user, $amount, $type, $description, $referenceId, $referenceType, &$success) {
                $fresh = User::lockForUpdate()->findOrFail($user->id);

                if ($fresh->kitties < $amount) {
                    $success = false;
                    return; // rolls back transaction
                }

                $fresh->kitties -= $amount;
                $fresh->save();

                KittyTransaction::create([
                    'user_id'        => $fresh->id,
                    'amount'         => -$amount,
                    'type'           => $type,
                    'description'    => $description,
                    'reference_id'   => $referenceId,
                    'reference_type' => $referenceType,
                    'balance_after'  => $fresh->kitties,
                ]);

                $user->kitties = $fresh->kitties;
                $success = true;
            });

            return $success;
        } catch (Throwable $e) {
            Log::error('EconomyService::deduct failed', ['user_id' => $user->id, 'amount' => $amount, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Transfer kitties between two users atomically.
     */
    public function transfer(User $from, User $to, int $amount, string $type, string $description, ?int $referenceId = null, ?string $referenceType = null): bool
    {
        if ($amount <= 0 || $from->id === $to->id) {
            return false;
        }

        try {
            $success = false;

            DB::transaction(function () use ($from, $to, $amount, $type, $description, $referenceId, $referenceType, &$success) {
                // Always lock in consistent order (lower id first) to prevent deadlocks
                $ids = [$from->id, $to->id];
                sort($ids);

                $users = User::lockForUpdate()->whereIn('id', $ids)->orderBy('id')->get()->keyBy('id');

                $sender   = $users[$from->id];
                $receiver = $users[$to->id];

                if ($sender->kitties < $amount) {
                    $success = false;
                    return;
                }

                $sender->kitties -= $amount;
                $receiver->kitties += $amount;

                $sender->save();
                $receiver->save();

                KittyTransaction::create([
                    'user_id'        => $sender->id,
                    'amount'         => -$amount,
                    'type'           => $type,
                    'description'    => "Sent to {$receiver->name}: {$description}",
                    'reference_id'   => $referenceId,
                    'reference_type' => $referenceType,
                    'balance_after'  => $sender->kitties,
                ]);

                KittyTransaction::create([
                    'user_id'        => $receiver->id,
                    'amount'         => $amount,
                    'type'           => $type,
                    'description'    => "Received from {$sender->name}: {$description}",
                    'reference_id'   => $referenceId,
                    'reference_type' => $referenceType,
                    'balance_after'  => $receiver->kitties,
                ]);

                $from->kitties = $sender->kitties;
                $to->kitties   = $receiver->kitties;
                $success = true;
            });

            return $success;
        } catch (Throwable $e) {
            Log::error('EconomyService::transfer failed', [
                'from'   => $from->id,
                'to'     => $to->id,
                'amount' => $amount,
                'error'  => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get paginated transaction history for a user.
     */
    public function history(User $user, int $perPage = 20)
    {
        return KittyTransaction::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }
}
