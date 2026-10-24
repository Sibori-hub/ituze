<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The chat window in the dashboard: a user talks with ITUZE support.
 * The window asks for new messages every few seconds while it is open.
 */
class ChatController extends Controller
{
    public function __construct(private ChatService $chat)
    {
    }

    /** Messages after `after` (all of them the first time); marks support replies as read. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user->isAdmin(), 404);
        $conversation = $this->chat->conversationFor($user);
        $after = (int) $request->query('after', 0);

        $messages = $conversation->messages()->with('sender:id,name')
            ->when($after > 0, fn ($query) => $query->where('id', '>', $after))
            ->orderByDesc('id')->limit(100)->get()->reverse()->values();

        if ($request->boolean('read')) {
            $conversation->messages()->where('from_support', true)->whereNull('read_at')->update(['read_at' => now()]);
        }

        return response()->json([
            'messages' => $messages->map->toClient(),
            'unread' => $conversation->messages()->where('from_support', true)->whereNull('read_at')->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_if($user->isAdmin(), 404);
        $data = $this->validateMessage($request);

        $message = $this->chat->send($this->chat->conversationFor($user), $user, false, $data['body'] ?? null, $request->file('file'));

        return response()->json(['message' => $message->load('sender:id,name')->toClient()], 201);
    }

    /** Files are private: only the user of the conversation and admins can open them. */
    public function attachment(Request $request, ChatMessage $message): StreamedResponse
    {
        $user = $request->user();
        abort_unless($message->attachment_path && ($user->isAdmin() || $message->conversation->user_id === $user->id), 404);

        return Storage::disk('local')->response($message->attachment_path, $message->attachment_name);
    }

    public static function messageRules(): array
    {
        return [
            'body' => ['nullable', 'string', 'max:4000', 'required_without:file'],
            'file' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,gif,pdf', 'max:5120'],
        ];
    }

    private function validateMessage(Request $request): array
    {
        return $request->validate(self::messageRules(), [
            'body.required_without' => 'Write a message or attach a file.',
            'file.mimes' => 'Send a photo (JPG, PNG) or a PDF.',
            'file.max' => 'The file must be 5 MB or smaller.',
        ]);
    }
}
