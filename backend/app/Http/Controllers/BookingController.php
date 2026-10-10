<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BookingController extends Controller
{
    /** Related data returned with every booking. */
    private const WITH = ['event:id,venue_id,title,starts_at,ends_at,ticket_price,status', 'event.venue:id,name,city', 'user:id,name,email'];

    /**
     * GET /api/bookings (any logged-in user)
     * A customer sees their own bookings, an organiser sees bookings for
     * their own events, and admin and staff see every booking.
     * Optional query: search, status, event_id, sort, direction, per_page, page.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(Booking::STATUSES)],
            'event_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['id', 'created_at', 'quantity', 'total_price', 'status'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $bookings = $this->visibleTo($request->user())
            ->with(self::WITH)
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('booking_reference', 'like', "%{$search}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))
                        ->orWhereHas('event', fn ($e) => $e->where('title', 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($filters['event_id'] ?? null, fn ($query, $eventId) => $query->where('event_id', $eventId))
            ->orderBy($filters['sort'] ?? 'id', $filters['direction'] ?? 'desc')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json($bookings);
    }

    /**
     * POST /api/bookings (customer)
     * Body: event_id, quantity.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_id' => ['required', 'integer', 'exists:events,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10'],
        ]);

        // A transaction with a row lock: two customers booking the last
        // tickets at the same moment cannot both succeed (no overselling).
        $result = DB::transaction(function () use ($data, $request) {
            $event = Event::lockForUpdate()->findOrFail($data['event_id']);

            // Business rule: only published events can be booked.
            if ($event->status !== 'published') {
                return 'This event is not open for booking.';
            }

            // Business rule: no bookings once the event has started.
            if ($event->starts_at->isPast()) {
                return 'This event has already started.';
            }

            // Business rule: there must be enough tickets left.
            if ($event->available_tickets < $data['quantity']) {
                return $event->available_tickets === 0
                    ? 'This event is sold out.'
                    : "Only {$event->available_tickets} tickets are left for this event.";
            }

            $booking = new Booking($data);
            $booking->user_id = $request->user()->id;
            $booking->booking_reference = $this->newReference();
            $booking->total_price = $event->ticket_price * $data['quantity'];
            $booking->status = 'confirmed';
            $booking->save();

            $event->decrement('available_tickets', $data['quantity']);

            return $booking;
        });

        if (is_string($result)) {
            return response()->json(['message' => $result], 409);
        }

        return response()->json([
            'message' => 'Booking confirmed.',
            'data' => $result->load(self::WITH),
        ], 201);
    }

    /**
     * GET /api/bookings/{booking}
     */
    public function show(Request $request, Booking $booking): JsonResponse
    {
        if (! $this->canAccess($request->user(), $booking)) {
            return $this->forbidden();
        }

        return response()->json(['data' => $booking->load(self::WITH)]);
    }

    /**
     * PUT /api/bookings/{booking}
     * Body: status = "cancelled" or "checked_in".
     * A customer can cancel their own booking. Staff, admins and the
     * event's organiser can cancel a booking or check the customer in.
     */
    public function update(Request $request, Booking $booking): JsonResponse
    {
        $user = $request->user();

        if (! $this->canAccess($user, $booking)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(['cancelled', 'checked_in'])],
        ]);

        // Business rule: a customer may cancel, but only staff can check in.
        if ($user->role === 'customer' && $data['status'] !== 'cancelled') {
            return $this->forbidden('Forbidden. Customers can only cancel a booking.');
        }

        $result = DB::transaction(function () use ($booking, $data, $user) {
            $event = Event::lockForUpdate()->findOrFail($booking->event_id);
            $booking->refresh();

            // Business rule: only a confirmed booking can change status.
            if ($booking->status !== 'confirmed') {
                return 'This booking is already '.str_replace('_', ' ', $booking->status).'.';
            }

            // Business rule: a customer cannot cancel after the event starts.
            if ($user->role === 'customer' && $event->starts_at->isPast()) {
                return 'This event has already started, so the booking cannot be cancelled.';
            }

            $booking->status = $data['status'];
            $booking->save();

            // Business rule: a cancelled booking returns its tickets.
            if ($data['status'] === 'cancelled') {
                $event->increment('available_tickets', $booking->quantity);
            }

            return $booking;
        });

        if (is_string($result)) {
            return response()->json(['message' => $result], 409);
        }

        return response()->json([
            'message' => $data['status'] === 'cancelled' ? 'Booking cancelled.' : 'Customer checked in.',
            'data' => $result->load(self::WITH),
        ]);
    }

    /**
     * DELETE /api/bookings/{booking} (admin)
     */
    public function destroy(Booking $booking): JsonResponse
    {
        // Business rule: only cancelled bookings can be removed, so
        // confirmed and checked-in bookings always stay on record.
        if ($booking->status !== 'cancelled') {
            return response()->json([
                'message' => 'Only cancelled bookings can be deleted. Cancel the booking first.',
            ], 409);
        }

        $booking->delete();

        return response()->json(['message' => 'Booking deleted.']);
    }

    /**
     * GET /api/bookings/{booking}/qr
     * Returns the booking's QR code, generated by the goQR.me web API.
     */
    public function qr(Request $request, Booking $booking): JsonResponse
    {
        if (! $this->canAccess($request->user(), $booking)) {
            return $this->forbidden();
        }

        // Performance: the image for a reference never changes, so it is
        // cached for a day and the external API is only called once.
        $cacheKey = 'booking-qr:'.$booking->booking_reference;
        $cached = Cache::has($cacheKey);

        try {
            $image = Cache::remember($cacheKey, now()->addDay(), function () use ($booking) {
                // Third-party API call: GET https://api.qrserver.com/v1/create-qr-code/
                $response = Http::timeout(10)->get(config('eventhub.qr_api_url'), [
                    'data' => $booking->booking_reference,
                    'size' => '300x300',
                    'format' => 'png',
                    'margin' => 10,
                ]);

                // throw() turns a 4xx or 5xx reply into an exception.
                $response->throw();

                return base64_encode($response->body());
            });
        } catch (ConnectionException|RequestException $e) {
            report($e);

            return response()->json([
                'message' => 'The QR code service is not available right now. Please try again shortly.',
            ], 502);
        }

        return response()->json([
            'data' => [
                'booking_id' => $booking->id,
                'booking_reference' => $booking->booking_reference,
                'status' => $booking->status,
                'qr_code' => 'data:image/png;base64,'.$image,
                'provider' => 'goQR.me (api.qrserver.com)',
                'from_cache' => $cached,
            ],
        ]);
    }

    /**
     * The bookings a user is allowed to see.
     */
    private function visibleTo(User $user): Builder
    {
        return Booking::query()
            ->when($user->role === 'customer', fn ($query) => $query->where('user_id', $user->id))
            ->when($user->role === 'organiser', fn ($query) => $query->whereHas('event', fn ($e) => $e->where('organiser_id', $user->id)));
    }

    private function canAccess(User $user, Booking $booking): bool
    {
        return $this->visibleTo($user)->whereKey($booking->id)->exists();
    }

    private function forbidden(string $message = 'Forbidden. You cannot access this booking.'): JsonResponse
    {
        return response()->json(['message' => $message], 403);
    }

    /**
     * A unique reference such as BK-7K2M9QXA.
     */
    private function newReference(): string
    {
        do {
            $reference = 'BK-'.strtoupper(Str::random(8));
        } while (Booking::where('booking_reference', $reference)->exists());

        return $reference;
    }
}
