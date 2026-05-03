<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateThumbnail;
use App\Models\Avatar;
use App\Models\UserItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AvatarController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $avatar = Avatar::firstOrCreate(
            ['user_id' => $user->id],
            ['body_color' => '#f5cba7']
        );

        // Load inventory grouped by category
        $inventory = UserItem::where('user_id', $user->id)
            ->with('item:id,name,category,thumbnail_url,color_primary,color_secondary,type')
            ->get()
            ->groupBy('item.category');

        return Inertia::render('Avatar/Index', [
            'avatar'    => $avatar,
            'inventory' => $inventory,
            'slots'     => Avatar::slots(),
        ]);
    }

    public function save(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'body_color'        => 'nullable|string|regex:/^#[0-9a-fA-F]{6}$/',
            'hat_user_item_id'  => 'nullable|integer|exists:user_items,id',
            'face_user_item_id' => 'nullable|integer|exists:user_items,id',
            'shirt_user_item_id'=> 'nullable|integer|exists:user_items,id',
            'pants_user_item_id'=> 'nullable|integer|exists:user_items,id',
            'shoes_user_item_id'=> 'nullable|integer|exists:user_items,id',
            'accessory_user_item_id' => 'nullable|integer|exists:user_items,id',
        ]);

        try {
            // Verify ownership of all submitted user_item_ids
            $slotColumns = ['hat_user_item_id', 'face_user_item_id', 'shirt_user_item_id', 'pants_user_item_id', 'shoes_user_item_id', 'accessory_user_item_id'];

            foreach ($slotColumns as $col) {
                if (!empty($validated[$col])) {
                    $owned = UserItem::where('id', $validated[$col])
                        ->where('user_id', $user->id)
                        ->exists();

                    if (!$owned) {
                        return back()->with('error', "You don't own one of the selected items.");
                    }

                    // Verify item category matches the slot
                    $slot   = str_replace(['_user_item_id'], '', $col);
                    $uItem  = UserItem::with('item:id,category')->find($validated[$col]);
                    if ($uItem && $uItem->item && $uItem->item->category !== $slot) {
                        return back()->with('error', "Item category doesn't match slot.");
                    }
                }
            }

            $avatar = Avatar::updateOrCreate(
                ['user_id' => $user->id],
                array_merge(['body_color' => '#f5cba7'], $validated)
            );

            // Queue thumbnail regen
            GenerateThumbnail::dispatch($avatar->id, 'avatar');

            return back()->with('success', 'Avatar saved!');
        } catch (Throwable $e) {
            Log::error('AvatarController::save error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to save avatar.');
        }
    }
}
