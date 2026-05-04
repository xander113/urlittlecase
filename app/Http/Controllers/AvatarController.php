<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateThumbnail;
use App\Models\Avatar;
use App\Models\User;
use App\Models\UserItem;
use App\Services\RCCService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AvatarController extends Controller
{
    private const VALID_TYPES = ['full_body', 'headshot', 'bust'];
    private const VALID_SIZES = [48, 60, 75, 100, 110, 150, 180, 352, 420, 720];

    public function __construct(private RCCService $rcc) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        $avatar = Avatar::firstOrCreate(
            ['user_id' => $user->id],
            ['body_color' => '#D9D9D9']
        );

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
            'body_color'             => 'nullable|string|regex:/^#[0-9a-fA-F]{6}$/',
            'hat_user_item_id'       => 'nullable|integer|exists:user_items,id',
            'face_user_item_id'      => 'nullable|integer|exists:user_items,id',
            'shirt_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'pants_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'shoes_user_item_id'     => 'nullable|integer|exists:user_items,id',
            'accessory_user_item_id' => 'nullable|integer|exists:user_items,id',
        ]);

        try {
            $slotColumns = [
                'hat_user_item_id','face_user_item_id','shirt_user_item_id',
                'pants_user_item_id','shoes_user_item_id','accessory_user_item_id',
            ];

            foreach ($slotColumns as $col) {
                if (empty($validated[$col])) continue;
                $slot  = str_replace('_user_item_id', '', $col);
                $uItem = UserItem::with('item:id,category')->find($validated[$col]);
                if (!$uItem || $uItem->user_id !== $user->id) {
                    return back()->with('error', "You don't own one of the selected items.");
                }
                if ($uItem->item && $uItem->item->category !== $slot) {
                    return back()->with('error', "Item category doesn't match slot.");
                }
            }

            $avatar = Avatar::updateOrCreate(
                ['user_id' => $user->id],
                array_merge(['body_color' => '#D9D9D9'], $validated)
            );

            // Queue async 3D thumbnail regeneration (all three types)
            GenerateThumbnail::dispatch($avatar->id, 'avatar');

            return back()->with('success', 'Avatar saved!');
        } catch (Throwable $e) {
            Log::error('AvatarController::save', ['error' => $e->getMessage()]);
            return back()->with('error', 'Failed to save avatar.');
        }
    }

    /**
     * POST /avatar/thumbnail
     *
     * JSON endpoint — called from the browser via window.axios (CSRF-safe).
     * Renders a live preview thumbnail via the Python RCC 3D service.
     *
     * Request body:
     *   body_color      : "#D9D9D9"
     *   slot_colors     : {hat:{primary,secondary}, shirt:{primary}, ...}
     *   thumbnail_type  : "full_body" | "headshot" | "bust"  (default: full_body)
     *   size            : 48|60|75|100|110|150|180|352|420|720  (default: 420)
     *   y_rot_deg       : -90 to 90  (default: 0)
     *   distance_scale  : 0.3–5.0   (default: 1.0)
     *   bg_color        : hex or "transparent"  (default: transparent)
     *
     * Response JSON:
     *   { url: "/storage/thumbnails/avatar_xxxx_420.png" }
     */
    public function regenerateThumbnail(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'body_color'     => 'nullable|string|max:20',
            'slot_colors'    => 'nullable|array',
            'slot_colors.*'  => 'nullable|array',
            'thumbnail_type' => 'nullable|string|in:full_body,headshot,bust',
            'size'           => 'nullable|integer|in:48,60,75,100,110,150,180,352,420,720',
            'y_rot_deg'      => 'nullable|numeric|min:-90|max:90',
            'distance_scale' => 'nullable|numeric|min:0.3|max:5',
            'bg_color'       => 'nullable|string|max:20',
        ]);

        $bodyColor     = $validated['body_color']     ?? '#D9D9D9';
        $slotColors    = $validated['slot_colors']    ?? [];
        $thumbnailType = $validated['thumbnail_type'] ?? 'full_body';
        $size          = (int) ($validated['size']    ?? 420);
        $yRot          = (float) ($validated['y_rot_deg']      ?? 0);
        $dScale        = (float) ($validated['distance_scale'] ?? 1.0);
        $bgColor       = $validated['bg_color'] ?? null;

        try {
            $url = $this->rcc->renderAvatarFromColors(
                $bodyColor, $slotColors, $user->id,
                $thumbnailType, $size, $yRot, $dScale, $bgColor,
            );

            if (!$url) {
                return response()->json([
                    'error' => 'Thumbnail service unavailable. Save your avatar to regenerate.',
                ], 503);
            }

            // Update user's stored thumbnail when it's a full_body or headshot
            if (in_array($thumbnailType, ['full_body', 'headshot'])) {
                User::where('id', $user->id)->update(['avatar_thumbnail' => $url]);
            }

            return response()->json(['url' => $url, 'type' => $thumbnailType, 'size' => $size]);
        } catch (Throwable $e) {
            Log::error('AvatarController::regenerateThumbnail', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to generate thumbnail.'], 500);
        }
    }

    /**
     * GET /avatar/types
     * Returns the supported thumbnail types and sizes from the RCC service.
     */
    public function types()
    {
        return response()->json($this->rcc->getSupportedTypes());
    }
}
