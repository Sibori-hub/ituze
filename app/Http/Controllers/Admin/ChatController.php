<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ChatController as UserChatController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\SubscriptionController;
use App\Models\ChatConversation;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin → Chats: every user's conversation with ITUZE support, newest first,
 * with who they are next to the messages.
 */
class ChatController extends Controller
{
    public function __construct(private ChatService $chat)
    {
    }

    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Chats', [
            'conversations' => $this->conversationList(trim((string) $request->query('search', ''))),
            'selected' => $request->integer('conversation') ?: null,
        ]);
    }

    /** The list, polled by the page so new chats appear without reloading. */
    public function list(Request $request): JsonResponse
    {
        return response()->json(['conversations' => $this->conversationList(trim((string) $request->query('search', '')))]);
    }

    /** One conversation: the person and the messages after `after`; marks their messages as read. */
    public function show(Request $request, ChatConversation $conversation): JsonResponse
    {
        $after = (int) $request->query('after', 0);
        $messages = $conversation->messages()->with('sender:id,name')
            ->when($after > 0, fn ($query) => $query->where('id', '>', $after))
            ->orderByDesc('id')->limit(200)->get()->reverse()->values();
        $conversation->messages()->where('from_support', false)->whereNull('read_at')->update(['read_at' => now()]);

        $user = $conversation->user;

        return response()->json([
            'messages' => $messages->map->toClient(),
            'person' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->roleLabel(),
                'status' => $user->status,
                'houses' => $user->isOwner() ? $user->housesUsed() : null,
                'paid_houses' => $user->paysSubscription() ? $user->properties()->subscriptionActive()->count() : null,
                'subscription' => $user->paysSubscription() ? SubscriptionController::statusFor($user) : null,
                'member_since' => $user->created_at?->toIso8601String(),
            ] : null,
        ]);
    }

    public function store(Request $request, ChatConversation $conversation): JsonResponse
    {
        $data = $request->validate(UserChatController::messageRules(), [
            'body.required_without' => 'Write a message or attach a file.',
        ]);
        $message = $this->chat->send($conversation, $request->user(), true, $data['body'] ?? null, $request->file('file'));

        return response()->json(['message' => $message->load('sender:id,name')->toClient()], 201);
    }

    private function conversationList(string $search): array
    {
        return ChatConversation::query()
            ->whereNotNull('last_message_at')
            ->with(['user:id,name,email,phone,role,deleted_at', 'messages' => fn ($query) => $query->latest('id')->limit(1)])
            ->withCount(['messages as unread' => fn ($query) => $query->where('from_support', false)->whereNull('read_at')])
            ->when($search !== '', fn ($query) => $query->whereHas('user', fn ($user) => $user
                ->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->orderByDesc('last_message_at')
            ->limit(100)
            ->get()
            ->map(fn (ChatConversation $conversation) => [
                'id' => $conversation->id,
                'name' => $conversation->user?->name ?? '—',
                'role' => $conversation->user?->roleLabel(),
                'unread' => $conversation->unread,
                'last' => $conversation->messages->first()?->body ?? ($conversation->messages->first()?->attachment_name ? '📎 '.$conversation->messages->first()->attachment_name : ''),
                'last_from_support' => (bool) $conversation->messages->first()?->from_support,
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            ])
            ->all();
    }
}
