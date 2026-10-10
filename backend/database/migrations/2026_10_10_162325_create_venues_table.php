<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('venues', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('address');
            $table->string('city', 100);
            $table->unsignedInteger('capacity');
            $table->timestamps();

            $table->unique(['name', 'city']);
        });

        DB::statement('ALTER TABLE venues ADD CONSTRAINT chk_venues_capacity CHECK (capacity > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('venues');
    }
};
