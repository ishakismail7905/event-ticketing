<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // This is an API: never redirect guests to a login page.
        $middleware->redirectGuestsTo(null);

        // Short name for the role check, used as 'role:admin,organiser'.
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every error under /api is returned as JSON.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Central error handling: one JSON shape for every API error.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            // Validation errors keep Laravel's 422 response with field messages.
            if ($e instanceof ValidationException) {
                return null;
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'message' => 'Unauthenticated. Log in and send a valid token.',
                ], 401);
            }

            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;

            $message = match ($status) {
                403 => 'Forbidden. You are not allowed to do this.',
                404 => 'Resource not found.',
                405 => 'Method not allowed for this URL.',
                429 => 'Too many requests. Please slow down.',
                500 => 'Server error. Please try again later.',
                default => $e->getMessage() ?: 'Request failed.',
            };

            return response()->json(['message' => $message], $status);
        });
    })->create();
