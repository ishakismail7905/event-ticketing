<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Allow the request only if the logged-in user has one of the given roles.
     * Used on routes as: ->middleware('role:admin,organiser')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => 'Forbidden. Your role is not allowed to do this.',
            ], 403);
        }

        return $next($request);
    }
}
