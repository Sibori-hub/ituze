<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin → Messages: everything sent through the "Contact us" form and the
 * Inquiry buttons. A message is "new" until the admin marks it answered
 * (stored in read_at).
 */
class ContactMessageController extends Controller
{
    public function index(Request $request): Response
    {
        $status = in_array($request->query('status'), ['new', 'answered', 'all'], true) ? $request->query('status') : 'new';
        $search = trim((string) $request->query('search', ''));

        $messages = ContactMessage::query()
            ->when($status === 'new', fn ($query) => $query->whereNull('read_at'))
            ->when($status === 'answered', fn ($query) => $query->whereNotNull('read_at'))
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(fn ($inner) => $inner->where('name', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('message', 'like', $like));
            })
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (ContactMessage $message) => [
                'id' => $message->id,
                'name' => $message->name,
                'phone' => $message->phone,
                'email' => $message->email,
                'topic' => $message->topic,
                'topic_label' => $message->topicLabel(),
                'message' => $message->message,
                'created_at' => $message->created_at,
                'answered_at' => $message->read_at,
            ]);

        return Inertia::render('Admin/Messages', [
            'messages' => $messages,
            'filters' => ['status' => $status, 'search' => $search],
            'counts' => [
                'new' => ContactMessage::query()->whereNull('read_at')->count(),
                'answered' => ContactMessage::query()->whereNotNull('read_at')->count(),
                'all' => ContactMessage::query()->count(),
            ],
        ]);
    }

    public function update(Request $request, ContactMessage $message): RedirectResponse
    {
        $answered = $request->boolean('answered');
        $message->forceFill(['read_at' => $answered ? now() : null])->save();

        return back()->with('success', $answered ? 'Marked as answered.' : 'Moved back to new messages.');
    }

    public function destroy(ContactMessage $message): RedirectResponse
    {
        $message->delete();

        return back()->with('success', 'The message from '.$message->name.' was deleted.');
    }
}
