<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->string('booking_reference', 20)->unique();
            $table->unsignedSmallInteger('quantity');
            $table->decimal('total_price', 10, 2);
            $table->enum('status', ['confirmed', 'cancelled', 'checked_in'])->default('confirmed');
            $table->timestamps();
        });

        DB::statement('ALTER TABLE bookings ADD CONSTRAINT chk_bookings_quantity CHECK (quantity BETWEEN 1 AND 10)');
        DB::statement('ALTER TABLE bookings ADD CONSTRAINT chk_bookings_total CHECK (total_price >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
