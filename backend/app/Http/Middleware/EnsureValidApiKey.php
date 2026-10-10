<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureValidApiKey
{
    /**
     * Allow the request only if it sends the correct X-API-Key header.
     * Used for machine-to-machine endpoints that have no logged-in user.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('eventhub.api_key');
        $given = (string) $request->header('X-API-Key');

        // hash_equals compares in constant time, which avoids timing attacks.
        if ($expected === '' || ! hash_equals($expected, $given)) {
            return response()->json([
                'message' => 'Invalid or missing API key.',
            ], 401);
        }

        return $next($request);
    }
}
