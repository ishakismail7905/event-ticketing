<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_id')->constrained()->restrictOnDelete();
            $table->foreignId('organiser_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->string('category', 50);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->decimal('ticket_price', 8, 2);
            $table->unsignedInteger('total_tickets');
            $table->unsignedInteger('available_tickets');
            $table->enum('status', ['draft', 'published', 'cancelled'])->default('draft');
            $table->timestamps();

            $table->index(['status', 'starts_at']);
        });

        DB::statement('ALTER TABLE events ADD CONSTRAINT chk_events_dates CHECK (ends_at > starts_at)');
        DB::statement('ALTER TABLE events ADD CONSTRAINT chk_events_price CHECK (ticket_price >= 0)');
        DB::statement('ALTER TABLE events ADD CONSTRAINT chk_events_tickets CHECK (available_tickets <= total_tickets)');
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
