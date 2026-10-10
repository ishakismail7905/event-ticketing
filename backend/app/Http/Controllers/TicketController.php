<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Http\JsonResponse;

/**
 * Ticket verification for external systems, such as a scanner at the venue
 * door. These routes use an API key, not a user login (see routes/api.php).
 */
class TicketController extends Controller
{
    /**
     * GET /api/tickets/{reference}
     * Look up a booking by the reference stored in its QR code.
     */
    public function show(string $reference): JsonResponse
    {
        $booking = Booking::with(['event:id,venue_id,title,starts_at,status', 'event.venue:id,name,city', 'user:id,name'])
            ->where('booking_reference', strtoupper($reference))
            ->first();

        if (! $booking) {
            return response()->json([
                'message' => 'No ticket found for this reference.',
                'data' => ['valid' => false],
            ], 404);
        }

        return response()->json([
            'data' => [
                // A ticket admits people only while the booking is confirmed.
                'valid' => $booking->status === 'confirmed',
                'booking_reference' => $booking->booking_reference,
                'status' => $booking->status,
                'quantity' => $booking->quantity,
                'holder' => $booking->user->name,
                'event' => $booking->event->title,
                'venue' => $booking->event->venue->name,
                'starts_at' => $booking->event->starts_at->format('Y-m-d H:i:s'),
            ],
        ]);
    }
}
