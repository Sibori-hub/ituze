<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class MobileAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ]);

        if (! Auth::guard('web')->once([
            'email' => $validated['email'],
            'password' => $validated['password'],
        ])) {
            return response()->json(['message' => trans('auth.failed')], 401);
        }

        $user = Auth::guard('web')->user();

        if (! $user instanceof User) {
            return response()->json(['message' => trans('auth.failed')], 401);
        }

        if (! config('auth.email_otp_enabled') && ! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return response()->json([
            'token' => $user->createToken($validated['device_name'] ?? 'ituze-mobile')->plainTextToken,
            'user' => $this->userData($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userData($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public static function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'profile_completed' => $user->profile_completed,
            'email_verified' => $user->hasVerifiedEmail(),
        ];
    }
}
