<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class ReportController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'reported_user_id' => 'nullable|integer|exists:users,id',
            'reported_item_id' => 'nullable|integer|exists:items,id',
            'reason'           => 'required|string|max:200',
            'details'          => 'nullable|string|max:1000',
        ]);

        if (empty($validated['reported_user_id']) && empty($validated['reported_item_id'])) {
            return back()->with('error', 'Please specify what you are reporting.');
        }

        // Prevent spam: max 3 reports per user per hour
        $recentCount = Report::where('reporter_id', $request->user()->id)
            ->where('created_at', '>', now()->subHour())
            ->count();

        if ($recentCount >= 3) {
            return back()->with('error', 'You have submitted too many reports recently.');
        }

        try {
            Report::create(array_merge($validated, ['reporter_id' => $request->user()->id]));
            return back()->with('success', 'Report submitted. Thank you.');
        } catch (Throwable $e) {
            Log::error('ReportController::store error', ['error' => $e->getMessage()]);
            return back()->with('error', 'Report submission failed.');
        }
    }
}
