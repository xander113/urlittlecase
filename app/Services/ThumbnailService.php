<?php

namespace App\Services;

use App\Models\Avatar;
use App\Models\Item;
use App\Models\UserItem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Renders avatar thumbnails using the character_model.obj as a base silhouette.
 * We project a simplified front-view of the OBJ onto a 420x420 canvas via GD,
 * then overlay item color layers and write the PNG to storage.
 */
class ThumbnailService
{
    private string $objPath;
    private int    $canvasSize = 420;

    public function __construct()
    {
        $this->objPath = public_path('models/character_model.obj');
    }

    /**
     * Generate thumbnail for an avatar and return the storage path.
     * Falls back gracefully if GD is unavailable.
     */
    public function generateAvatarThumbnail(Avatar $avatar): ?string
    {
        try {
            if (!extension_loaded('gd')) {
                Log::warning('ThumbnailService: GD extension not loaded; skipping thumbnail.');
                return null;
            }

            $canvas = imagecreatetruecolor($this->canvasSize, $this->canvasSize);
            if (!$canvas) {
                return null;
            }

            // Transparent background
            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefill($canvas, 0, 0, $transparent);

            // Draw body silhouette from OBJ
            $this->drawSilhouette($canvas, $avatar->body_color ?? '#f5cba7');

            // Overlay equipped item colors
            $this->overlayEquippedItems($canvas, $avatar);

            // Save
            $filename = 'avatars/' . $avatar->user_id . '_' . Str::random(8) . '.png';
            $tmpPath  = sys_get_temp_dir() . '/' . basename($filename);

            if (!imagepng($canvas, $tmpPath)) {
                imagedestroy($canvas);
                return null;
            }

            imagedestroy($canvas);

            Storage::disk('public')->put($filename, file_get_contents($tmpPath));
            @unlink($tmpPath);

            return $filename;
        } catch (Throwable $e) {
            Log::error('ThumbnailService::generateAvatarThumbnail failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Generate a simple item preview thumbnail.
     */
    public function generateItemThumbnail(Item $item): ?string
    {
        try {
            if (!extension_loaded('gd')) {
                return null;
            }

            $canvas = imagecreatetruecolor(420, 420);
            if (!$canvas) {
                return null;
            }

            imagesavealpha($canvas, true);
            $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
            imagefill($canvas, 0, 0, $transparent);

            // Draw the item category silhouette colored with primary color
            $this->drawItemPreview($canvas, $item);

            $filename = 'items/' . $item->id . '_' . Str::random(6) . '.png';
            $tmpPath  = sys_get_temp_dir() . '/' . basename($filename);

            if (!imagepng($canvas, $tmpPath)) {
                imagedestroy($canvas);
                return null;
            }

            imagedestroy($canvas);
            Storage::disk('public')->put($filename, file_get_contents($tmpPath));
            @unlink($tmpPath);

            return Storage::disk('public')->url($filename);
        } catch (Throwable $e) {
            Log::error('ThumbnailService::generateItemThumbnail failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    // ─── Private Rendering Helpers ────────────────────────────────────────────

    /**
     * Parse the OBJ file and project vertices to 2D front-view polygon.
     * Returns array of [x, y] projected coords.
     */
    private function parseObjVertices(): array
    {
        $vertices = [];

        if (!file_exists($this->objPath)) {
            return $this->fallbackVertices();
        }

        try {
            $lines = file($this->objPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $verts = [];

            foreach ($lines as $line) {
                $line = trim($line);
                if (strpos($line, 'v ') === 0) {
                    $parts = preg_split('/\s+/', $line);
                    if (count($parts) >= 4) {
                        $verts[] = [(float)$parts[1], (float)$parts[2], (float)$parts[3]];
                    }
                }
            }

            if (empty($verts)) {
                return $this->fallbackVertices();
            }

            // Find bounding box
            $xs = array_column($verts, 0);
            $ys = array_column($verts, 1);
            $minX = min($xs); $maxX = max($xs);
            $minY = min($ys); $maxY = max($ys);

            $scaleX = ($maxX - $minX) > 0 ? ($this->canvasSize * 0.8) / ($maxX - $minX) : 1;
            $scaleY = ($maxY - $minY) > 0 ? ($this->canvasSize * 0.8) / ($maxY - $minY) : 1;
            $scale  = min($scaleX, $scaleY);
            $offX   = ($this->canvasSize - ($maxX - $minX) * $scale) / 2;
            $offY   = ($this->canvasSize - ($maxY - $minY) * $scale) / 2;

            foreach ($verts as $v) {
                $vertices[] = [
                    (int)(($v[0] - $minX) * $scale + $offX),
                    (int)(($this->canvasSize - ($v[1] - $minY) * $scale) - $offY), // flip Y
                ];
            }
        } catch (Throwable $e) {
            Log::warning('ThumbnailService: OBJ parse failed, using fallback', ['error' => $e->getMessage()]);
            return $this->fallbackVertices();
        }

        return $vertices;
    }

    /**
     * Fallback humanoid silhouette polygon points when OBJ is unavailable.
     */
    private function fallbackVertices(): array
    {
        $s = $this->canvasSize;
        return [
            // Head
            [$s * 0.38, $s * 0.06],
            [$s * 0.62, $s * 0.06],
            [$s * 0.64, $s * 0.22],
            [$s * 0.36, $s * 0.22],
            // Neck + torso
            [$s * 0.40, $s * 0.24],
            [$s * 0.60, $s * 0.24],
            [$s * 0.65, $s * 0.55],
            [$s * 0.35, $s * 0.55],
            // Legs
            [$s * 0.36, $s * 0.56],
            [$s * 0.48, $s * 0.56],
            [$s * 0.48, $s * 0.92],
            [$s * 0.38, $s * 0.92],
            [$s * 0.38, $s * 0.56],
            [$s * 0.52, $s * 0.56],
            [$s * 0.52, $s * 0.92],
            [$s * 0.62, $s * 0.92],
            [$s * 0.62, $s * 0.56],
        ];
    }

    private function drawSilhouette(\GdImage $canvas, string $bodyColor): void
    {
        [$r, $g, $b] = $this->hexToRgb($bodyColor);
        $color       = imagecolorallocate($canvas, $r, $g, $b);
        $s           = $this->canvasSize;

        // Head
        imagefilledellipse($canvas, $s / 2, (int)($s * 0.14), (int)($s * 0.28), (int)($s * 0.28), $color);
        // Torso
        imagefilledrectangle($canvas, (int)($s * 0.35), (int)($s * 0.26), (int)($s * 0.65), (int)($s * 0.58), $color);
        // Left arm
        imagefilledrectangle($canvas, (int)($s * 0.22), (int)($s * 0.27), (int)($s * 0.35), (int)($s * 0.56), $color);
        // Right arm
        imagefilledrectangle($canvas, (int)($s * 0.65), (int)($s * 0.27), (int)($s * 0.78), (int)($s * 0.56), $color);
        // Left leg
        imagefilledrectangle($canvas, (int)($s * 0.36), (int)($s * 0.58), (int)($s * 0.49), (int)($s * 0.93), $color);
        // Right leg
        imagefilledrectangle($canvas, (int)($s * 0.51), (int)($s * 0.58), (int)($s * 0.64), (int)($s * 0.93), $color);

        // Draw OBJ-derived accent lines on top
        $vertices = $this->parseObjVertices();
        if (count($vertices) > 2) {
            $dark = imagecolorallocatealpha($canvas, max($r - 40, 0), max($g - 40, 0), max($b - 40, 0), 80);
            $prev = $vertices[0];
            $total = count($vertices);
            for ($i = 1; $i < min($total, 200); $i++) {
                imageline($canvas, $prev[0], $prev[1], $vertices[$i][0], $vertices[$i][1], $dark);
                $prev = $vertices[$i];
            }
        }
    }

    private function overlayEquippedItems(\GdImage $canvas, Avatar $avatar): void
    {
        $slots = [
            'shirt'     => [$avatar->shirt_user_item_id,     'shirt'],
            'pants'     => [$avatar->pants_user_item_id,     'pants'],
            'shoes'     => [$avatar->shoes_user_item_id,     'shoes'],
            'hat'       => [$avatar->hat_user_item_id,       'hat'],
            'face'      => [$avatar->face_user_item_id,      'face'],
            'accessory' => [$avatar->accessory_user_item_id, 'accessory'],
        ];

        foreach ($slots as [$userItemId, $slot]) {
            if (!$userItemId) {
                continue;
            }

            $userItem = UserItem::with('item')->find($userItemId);
            if (!$userItem || !$userItem->item) {
                continue;
            }

            $this->drawItemLayer($canvas, $slot, $userItem->item->color_primary, $userItem->item->color_secondary);
        }
    }

    private function drawItemLayer(\GdImage $canvas, string $slot, string $primary, string $secondary): void
    {
        $s = $this->canvasSize;
        [$r, $g, $b] = $this->hexToRgb($primary);
        $color = imagecolorallocatealpha($canvas, $r, $g, $b, 20);

        match ($slot) {
            'hat'       => imagefilledellipse($canvas, $s / 2, (int)($s * 0.08), (int)($s * 0.32), (int)($s * 0.14), $color),
            'face'      => imagefilledellipse($canvas, $s / 2, (int)($s * 0.14), (int)($s * 0.18), (int)($s * 0.12), $color),
            'shirt'     => imagefilledrectangle($canvas, (int)($s * 0.35), (int)($s * 0.26), (int)($s * 0.65), (int)($s * 0.58), $color),
            'pants'     => imagefilledrectangle($canvas, (int)($s * 0.36), (int)($s * 0.58), (int)($s * 0.64), (int)($s * 0.80), $color),
            'shoes'     => imagefilledrectangle($canvas, (int)($s * 0.36), (int)($s * 0.85), (int)($s * 0.64), (int)($s * 0.93), $color),
            'accessory' => imagefilledellipse($canvas, (int)($s * 0.75), (int)($s * 0.40), (int)($s * 0.12), (int)($s * 0.12), $color),
            default     => null,
        };
    }

    private function drawItemPreview(\GdImage $canvas, Item $item): void
    {
        $s = $this->canvasSize;
        [$r, $g, $b] = $this->hexToRgb($item->color_primary);
        $color = imagecolorallocate($canvas, $r, $g, $b);

        [$r2, $g2, $b2] = $this->hexToRgb($item->color_secondary);
        $color2 = imagecolorallocate($canvas, $r2, $g2, $b2);

        match ($item->category) {
            'hat'   => $this->drawHatPreview($canvas, $s, $color, $color2),
            'shirt' => $this->drawShirtPreview($canvas, $s, $color, $color2),
            'pants' => $this->drawPantsPreview($canvas, $s, $color, $color2),
            default => imagefilledellipse($canvas, $s / 2, $s / 2, (int)($s * 0.6), (int)($s * 0.6), $color),
        };

        // Item name label
        $textColor = imagecolorallocate($canvas, 20, 20, 20);
        imagestring($canvas, 3, (int)($s * 0.1), (int)($s * 0.9), substr($item->name, 0, 28), $textColor);
    }

    private function drawHatPreview(\GdImage $canvas, int $s, $c1, $c2): void
    {
        imagefilledellipse($canvas, $s / 2, (int)($s * 0.55), (int)($s * 0.7), (int)($s * 0.18), $c1);
        imagefilledrectangle($canvas, (int)($s * 0.35), (int)($s * 0.2), (int)($s * 0.65), (int)($s * 0.55), $c2);
        imagefilledellipse($canvas, $s / 2, (int)($s * 0.2), (int)($s * 0.3), (int)($s * 0.14), $c2);
    }

    private function drawShirtPreview(\GdImage $canvas, int $s, $c1, $c2): void
    {
        imagefilledrectangle($canvas, (int)($s * 0.3), (int)($s * 0.3), (int)($s * 0.7), (int)($s * 0.75), $c1);
        imagefilledrectangle($canvas, (int)($s * 0.1), (int)($s * 0.3), (int)($s * 0.3), (int)($s * 0.6), $c2);
        imagefilledrectangle($canvas, (int)($s * 0.7), (int)($s * 0.3), (int)($s * 0.9), (int)($s * 0.6), $c2);
    }

    private function drawPantsPreview(\GdImage $canvas, int $s, $c1, $c2): void
    {
        imagefilledrectangle($canvas, (int)($s * 0.32), (int)($s * 0.25), (int)($s * 0.68), (int)($s * 0.48), $c1);
        imagefilledrectangle($canvas, (int)($s * 0.32), (int)($s * 0.48), (int)($s * 0.49), (int)($s * 0.85), $c2);
        imagefilledrectangle($canvas, (int)($s * 0.51), (int)($s * 0.48), (int)($s * 0.68), (int)($s * 0.85), $c2);
    }

    private function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        return [
            hexdec(substr($hex, 0, 2)),
            hexdec(substr($hex, 2, 2)),
            hexdec(substr($hex, 4, 2)),
        ];
    }
}
