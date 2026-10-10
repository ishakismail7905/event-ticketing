<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Fill the four core tables with sample data.
     * Every sample account uses the password "password".
     */
    public function run(): void
    {
        $now = now();
        $password = Hash::make('password');

        $users = [
            ['Nur Aisyah Rahman', 'admin@eventhub.test', 'admin', '012-555 0101'],
            ['Daniel Lim', 'daniel@eventhub.test', 'organiser', '012-555 0102'],
            ['Priya Nair', 'priya@eventhub.test', 'organiser', '012-555 0103'],
            ['Hafiz Osman', 'hafiz@eventhub.test', 'staff', '012-555 0104'],
            ['Siti Aminah', 'siti@eventhub.test', 'customer', '012-555 0105'],
            ['Jason Tan', 'jason@eventhub.test', 'customer', '012-555 0106'],
            ['Kavitha Raj', 'kavitha@eventhub.test', 'customer', '012-555 0107'],
        ];

        foreach ($users as [$name, $email, $role, $phone]) {
            DB::table('users')->insert([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role' => $role,
                'phone' => $phone,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $venues = [
            ['Dewan Seri Budaya', '12 Jalan Merpati', 'Kuala Lumpur', 800],
            ['Laman Kota Convention Hall', '3 Persiaran Tasik', 'Shah Alam', 1500],
            ['Pentas Teater Kecil', '45 Lebuh Pantai', 'George Town', 250],
            ['Dataran Tasik Open Stage', 'Presint 2', 'Putrajaya', 3000],
            ['Galeri Studio Lima', '8 Jalan Dato Onn', 'Johor Bahru', 120],
        ];

        foreach ($venues as [$name, $address, $city, $capacity]) {
            DB::table('venues')->insert([
                'name' => $name,
                'address' => $address,
                'city' => $city,
                'capacity' => $capacity,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // venue_id, organiser_id, title, category, starts_at, ends_at,
        // ticket_price, total_tickets, available_tickets, status
        $events = [
            [1, 2, 'Malam Irama Akustik', 'Music', '2026-10-03 20:00:00', '2026-10-03 23:00:00', 85.00, 600, 594, 'published'],
            [2, 2, 'Tech Career Fair 2026', 'Conference', '2026-11-21 09:00:00', '2026-11-21 17:00:00', 0.00, 1500, 1499, 'published'],
            [3, 3, 'Teater Bangsawan Puteri Saadong', 'Theatre', '2026-12-05 20:30:00', '2026-12-05 22:30:00', 45.00, 250, 245, 'published'],
            [4, 3, 'Putrajaya Food and Music Festival', 'Festival', '2026-12-19 16:00:00', '2026-12-19 23:00:00', 30.00, 3000, 2995, 'published'],
            [5, 2, 'Beginner Photography Workshop', 'Workshop', '2027-01-10 10:00:00', '2027-01-10 13:00:00', 120.00, 40, 40, 'draft'],
            [1, 3, 'Stand-Up Comedy Night', 'Comedy', '2027-01-24 20:00:00', '2027-01-24 22:00:00', 60.00, 500, 500, 'cancelled'],
        ];

        foreach ($events as [$venueId, $organiserId, $title, $category, $startsAt, $endsAt, $price, $total, $available, $status]) {
            DB::table('events')->insert([
                'venue_id' => $venueId,
                'organiser_id' => $organiserId,
                'title' => $title,
                'description' => $title.' at a venue near you. Sample event for testing.',
                'category' => $category,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'ticket_price' => $price,
                'total_tickets' => $total,
                'available_tickets' => $available,
                'status' => $status,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // user_id, event_id, booking_reference, quantity, total_price, status
        $bookings = [
            [5, 1, 'BK-7K2M9QXA', 2, 170.00, 'checked_in'],
            [6, 1, 'BK-P4T8WZ3C', 4, 340.00, 'checked_in'],
            [7, 1, 'BK-H6N1RY5D', 1, 85.00, 'cancelled'],
            [5, 2, 'BK-B9V3LK7E', 1, 0.00, 'confirmed'],
            [6, 3, 'BK-Q2X5JM8F', 2, 90.00, 'confirmed'],
            [7, 3, 'BK-T7C4GS1H', 3, 135.00, 'confirmed'],
            [5, 4, 'BK-W3F6DN9J', 5, 150.00, 'confirmed'],
            [6, 4, 'BK-Z8R2AU4K', 2, 60.00, 'cancelled'],
        ];

        foreach ($bookings as [$userId, $eventId, $reference, $quantity, $totalPrice, $status]) {
            DB::table('bookings')->insert([
                'user_id' => $userId,
                'event_id' => $eventId,
                'booking_reference' => $reference,
                'quantity' => $quantity,
                'total_price' => $totalPrice,
                'status' => $status,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
