<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['venue_id', 'title', 'description', 'category', 'starts_at', 'ends_at', 'ticket_price', 'total_tickets', 'status'])]
class Event extends Model
{
    public const STATUSES = ['draft', 'published', 'cancelled'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'ticket_price' => 'decimal:2',
        ];
    }

    /**
     * The venue where this event takes place.
     */
    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    /**
     * The user who organises this event.
     */
    public function organiser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organiser_id');
    }

    /**
     * Bookings made for this event.
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * Show dates in JSON as "2026-10-11 09:30:00" in the app's timezone.
     */
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }
}
