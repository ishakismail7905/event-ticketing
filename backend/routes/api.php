<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VenueController;
use Illuminate\Support\Facades\Route;

// Public routes: no token needed.
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Anyone can browse venues and events.
Route::apiResource('venues', VenueController::class)->only(['index', 'show']);
Route::apiResource('events', EventController::class)->only(['index', 'show']);

// Protected routes: a valid JWT is required.
Route::middleware('auth:api')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Users: admin only.
    Route::apiResource('users', UserController::class)->middleware('role:admin');

    // Venues and events: admins and organisers create and update.
    Route::middleware('role:admin,organiser')->group(function () {
        Route::apiResource('venues', VenueController::class)->only(['store', 'update']);
        Route::apiResource('events', EventController::class)->only(['store', 'update', 'destroy']);
    });

    // Only an admin can delete a venue.
    Route::delete('/venues/{venue}', [VenueController::class, 'destroy'])->middleware('role:admin');
});
