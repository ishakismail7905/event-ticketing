<?php

namespace App\Http\Controllers;

use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VenueController extends Controller
{
    /**
     * GET /api/venues (public)
     * Optional query: search, city, min_capacity, sort, direction, per_page, page.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'min_capacity' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', Rule::in(['id', 'name', 'city', 'capacity', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $venues = Venue::query()
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%");
                });
            })
            ->when($filters['city'] ?? null, fn ($query, $city) => $query->where('city', $city))
            ->when($filters['min_capacity'] ?? null, fn ($query, $min) => $query->where('capacity', '>=', $min))
            ->orderBy($filters['sort'] ?? 'name', $filters['direction'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json($venues);
    }

    /**
     * POST /api/venues (admin, organiser)
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:150',
                Rule::unique('venues')->where(fn ($query) => $query->where('city', $request->input('city'))),
            ],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'capacity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ], [
            'name.unique' => 'A venue with this name already exists in this city.',
        ]);

        $venue = Venue::create($data);

        return response()->json([
            'message' => 'Venue created.',
            'data' => $venue,
        ], 201);
    }

    /**
     * GET /api/venues/{venue} (public)
     */
    public function show(Venue $venue): JsonResponse
    {
        $venue->loadCount('events');

        return response()->json(['data' => $venue]);
    }

    /**
     * PUT /api/venues/{venue} (admin, organiser)
     * Only the fields that are sent get changed.
     */
    public function update(Request $request, Venue $venue): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'sometimes', 'required', 'string', 'max:150',
                Rule::unique('venues')
                    ->where(fn ($query) => $query->where('city', $request->input('city', $venue->city)))
                    ->ignore($venue->id),
            ],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'city' => ['sometimes', 'required', 'string', 'max:100'],
            'capacity' => ['sometimes', 'required', 'integer', 'min:1', 'max:1000000'],
        ], [
            'name.unique' => 'A venue with this name already exists in this city.',
        ]);

        // Business rule: capacity cannot drop below the tickets of an active event.
        if (isset($data['capacity'])) {
            $largestEvent = $venue->events()->where('status', '!=', 'cancelled')->max('total_tickets');

            if ($largestEvent && $data['capacity'] < $largestEvent) {
                return response()->json([
                    'message' => "Capacity cannot be lower than {$largestEvent}, the ticket total of an event at this venue.",
                ], 409);
            }
        }

        $venue->update($data);

        return response()->json([
            'message' => 'Venue updated.',
            'data' => $venue,
        ]);
    }

    /**
     * DELETE /api/venues/{venue} (admin)
     */
    public function destroy(Venue $venue): JsonResponse
    {
        // Business rule: a venue that has events cannot be deleted.
        if ($venue->events()->exists()) {
            return response()->json([
                'message' => 'This venue has events and cannot be deleted.',
            ], 409);
        }

        $venue->delete();

        return response()->json(['message' => 'Venue deleted.']);
    }
}
