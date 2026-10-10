<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class EventController extends Controller
{
    /**
     * GET /api/events (public)
     * Guests and customers only see published events.
     * Optional query: search, category, venue_id, status, date_from, date_to,
     * available_only, sort, direction, per_page, page.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
            'venue_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(Event::STATUSES)],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'available_only' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['id', 'title', 'starts_at', 'ticket_price', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $canSeeAll = $this->canSeeUnpublished(auth('api')->user());

        // Eager loading: venue and organiser are fetched in 2 extra queries
        // in total, not 2 extra queries per event (avoids the N+1 problem).
        $events = Event::query()
            ->with(['venue:id,name,city', 'organiser:id,name'])
            ->when(! $canSeeAll, fn ($query) => $query->where('status', 'published'))
            ->when($canSeeAll && isset($filters['status']), fn ($query) => $query->where('status', $filters['status']))
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category', $category))
            ->when($filters['venue_id'] ?? null, fn ($query, $venueId) => $query->where('venue_id', $venueId))
            ->when($filters['date_from'] ?? null, fn ($query, $from) => $query->where('starts_at', '>=', $from))
            ->when($filters['date_to'] ?? null, fn ($query, $to) => $query->where('starts_at', '<=', $to.' 23:59:59'))
            ->when($request->boolean('available_only'), fn ($query) => $query->where('available_tickets', '>', 0))
            ->orderBy($filters['sort'] ?? 'starts_at', $filters['direction'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json($events);
    }

    /**
     * POST /api/events (admin, organiser)
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'venue_id' => ['required', 'integer', 'exists:venues,id'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'category' => ['required', 'string', 'max:50'],
            'starts_at' => ['required', 'date', 'after:now'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'ticket_price' => ['required', 'numeric', 'min:0', 'max:999999.99'],
            'total_tickets' => ['required', 'integer', 'min:1'],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'organiser_id' => [
                'nullable', 'integer',
                Rule::exists('users', 'id')->where('role', 'organiser'),
            ],
        ]);

        $venue = Venue::findOrFail($data['venue_id']);

        $startsAt = Carbon::parse($data['starts_at']);
        $endsAt = Carbon::parse($data['ends_at']);

        if ($error = $this->checkBusinessRules($venue, $data['total_tickets'], $startsAt, $endsAt)) {
            return $error;
        }

        $event = new Event($data);
        // Only an admin may create an event for another organiser.
        $event->organiser_id = $user->role === 'admin' ? ($data['organiser_id'] ?? $user->id) : $user->id;
        $event->available_tickets = $data['total_tickets'];
        $event->status = $data['status'] ?? 'draft';
        $event->save();

        return response()->json([
            'message' => 'Event created.',
            'data' => $event->load(['venue:id,name,city', 'organiser:id,name']),
        ], 201);
    }

    /**
     * GET /api/events/{event} (public)
     */
    public function show(Event $event): JsonResponse
    {
        // Unpublished events stay hidden from guests and customers.
        if ($event->status !== 'published' && ! $this->canSeeUnpublished(auth('api')->user())) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        return response()->json([
            'data' => $event->load(['venue', 'organiser:id,name']),
        ]);
    }

    /**
     * PUT /api/events/{event} (admin, or the organiser who owns it)
     * Only the fields that are sent get changed.
     */
    public function update(Request $request, Event $event): JsonResponse
    {
        if ($denied = $this->denyUnlessOwner($request->user(), $event)) {
            return $denied;
        }

        // Business rule: a cancelled event is final.
        if ($event->status === 'cancelled') {
            return response()->json([
                'message' => 'A cancelled event cannot be changed.',
            ], 409);
        }

        $data = $request->validate([
            'venue_id' => ['sometimes', 'required', 'integer', 'exists:venues,id'],
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'category' => ['sometimes', 'required', 'string', 'max:50'],
            'starts_at' => ['sometimes', 'required', 'date'],
            'ends_at' => ['sometimes', 'required', 'date'],
            'ticket_price' => ['sometimes', 'required', 'numeric', 'min:0', 'max:999999.99'],
            'total_tickets' => ['sometimes', 'required', 'integer', 'min:1'],
            'status' => ['sometimes', 'required', Rule::in(Event::STATUSES)],
        ]);

        $venue = Venue::findOrFail($data['venue_id'] ?? $event->venue_id);
        $startsAt = Carbon::parse($data['starts_at'] ?? $event->starts_at);
        $endsAt = Carbon::parse($data['ends_at'] ?? $event->ends_at);
        $totalTickets = $data['total_tickets'] ?? $event->total_tickets;
        $ticketsSold = $event->total_tickets - $event->available_tickets;

        if ($endsAt->lessThanOrEqualTo($startsAt)) {
            return response()->json([
                'message' => 'The end time must be after the start time.',
                'errors' => ['ends_at' => ['The end time must be after the start time.']],
            ], 422);
        }

        // Business rule: the ticket total cannot go below what is already sold.
        if ($totalTickets < $ticketsSold) {
            return response()->json([
                'message' => "Total tickets cannot be lower than the {$ticketsSold} already booked.",
            ], 409);
        }

        if ($error = $this->checkBusinessRules($venue, $totalTickets, $startsAt, $endsAt, $event->id)) {
            return $error;
        }

        DB::transaction(function () use ($event, $data, $totalTickets, $ticketsSold) {
            $event->fill($data);
            $event->available_tickets = $totalTickets - $ticketsSold;

            // Business rule: cancelling an event cancels its active bookings
            // and puts every ticket back.
            if (($data['status'] ?? null) === 'cancelled') {
                $event->bookings()->where('status', 'confirmed')->update(['status' => 'cancelled']);
                $event->available_tickets = $totalTickets;
            }

            $event->save();
        });

        return response()->json([
            'message' => 'Event updated.',
            'data' => $event->load(['venue:id,name,city', 'organiser:id,name']),
        ]);
    }

    /**
     * DELETE /api/events/{event} (admin, or the organiser who owns it)
     */
    public function destroy(Request $request, Event $event): JsonResponse
    {
        if ($denied = $this->denyUnlessOwner($request->user(), $event)) {
            return $denied;
        }

        // Business rule: an event with bookings is cancelled, never deleted.
        if ($event->bookings()->exists()) {
            return response()->json([
                'message' => 'This event has bookings. Cancel the event instead of deleting it.',
            ], 409);
        }

        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }

    /**
     * Admin, organiser and staff can see draft and cancelled events.
     */
    private function canSeeUnpublished(?User $user): bool
    {
        return $user !== null && in_array($user->role, ['admin', 'organiser', 'staff'], true);
    }

    /**
     * An organiser may only change their own events. An admin may change any.
     */
    private function denyUnlessOwner(User $user, Event $event): ?JsonResponse
    {
        if ($user->role === 'admin' || (int) $event->organiser_id === (int) $user->id) {
            return null;
        }

        return response()->json([
            'message' => 'Forbidden. You can only manage your own events.',
        ], 403);
    }

    /**
     * Rules shared by create and update. Returns an error response, or null if all pass.
     */
    private function checkBusinessRules(Venue $venue, int $totalTickets, Carbon $startsAt, Carbon $endsAt, ?int $ignoreEventId = null): ?JsonResponse
    {
        // Business rule: an event cannot sell more tickets than the venue holds.
        if ($totalTickets > $venue->capacity) {
            return response()->json([
                'message' => "Total tickets cannot be more than the venue capacity of {$venue->capacity}.",
                'errors' => ['total_tickets' => ["The venue only holds {$venue->capacity} people."]],
            ], 422);
        }

        // Business rule: two active events cannot overlap at the same venue.
        $clash = Event::query()
            ->where('venue_id', $venue->id)
            ->where('status', '!=', 'cancelled')
            ->when($ignoreEventId, fn ($query) => $query->where('id', '!=', $ignoreEventId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->first();

        if ($clash) {
            return response()->json([
                'message' => "The venue is already booked for \"{$clash->title}\" at that time.",
            ], 409);
        }

        return null;
    }
}
