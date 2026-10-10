<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogApiRequests
{
    /**
     * Write one line per API request to storage/logs/api.log:
     * method, path, status code, time taken, user and IP address.
     * Request bodies are never logged, so passwords stay out of the log.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = microtime(true);

        $response = $next($request);

        if ($request->is('api/*')) {
            Log::build([
                'driver' => 'single',
                'path' => storage_path('logs/api.log'),
            ])->info('api_request', [
                'method' => $request->method(),
                'path' => '/'.$request->path(),
                'status' => $response->getStatusCode(),
                'duration_ms' => round((microtime(true) - $startedAt) * 1000, 1),
                'user_id' => auth('api')->id(),
                'ip' => $request->ip(),
            ]);
        }

        return $response;
    }
}
