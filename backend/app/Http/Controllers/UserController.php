<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * User management. Every route here is admin only (see routes/api.php).
 */
class UserController extends Controller
{
    /**
     * GET /api/users
     * Optional query: search, role, sort, direction, per_page, page.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(User::ROLES)],
            'sort' => ['nullable', Rule::in(['id', 'name', 'email', 'role', 'created_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::query()
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($filters['role'] ?? null, fn ($query, $role) => $query->where('role', $role))
            ->orderBy($filters['sort'] ?? 'id', $filters['direction'] ?? 'asc')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json($users);
    }

    /**
     * POST /api/users
     * An admin can create a user with any role.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', Password::min(8)],
            'role' => ['required', Rule::in(User::ROLES)],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $user = new User($data);
        $user->role = $data['role'];
        $user->save();

        return response()->json([
            'message' => 'User created.',
            'data' => $user,
        ], 201);
    }

    /**
     * GET /api/users/{user}
     */
    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => $user]);
    }

    /**
     * PUT /api/users/{user}
     * Only the fields that are sent get changed.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'required', Password::min(8)],
            'role' => ['sometimes', 'required', Rule::in(User::ROLES)],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        // Business rule: an admin cannot remove their own admin role.
        if (isset($data['role']) && $user->is($request->user()) && $data['role'] !== 'admin') {
            return response()->json([
                'message' => 'You cannot change your own role.',
            ], 409);
        }

        $user->fill($data);

        if (isset($data['role'])) {
            $user->role = $data['role'];
        }

        $user->save();

        return response()->json([
            'message' => 'User updated.',
            'data' => $user,
        ]);
    }

    /**
     * DELETE /api/users/{user}
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        // Business rule: an admin cannot delete their own account.
        if ($user->is($request->user())) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 409);
        }

        // Business rule: keep users that still have events or bookings.
        if ($user->events()->exists() || $user->bookings()->exists()) {
            return response()->json([
                'message' => 'This user has events or bookings and cannot be deleted.',
            ], 409);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}
