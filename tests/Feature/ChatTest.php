<?php

namespace Tests\Feature;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\NewChatMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        Storage::fake('local');
        $this->admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0783163187']);
        $this->owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'phone' => '0788123456', 'name' => 'Jean Bosco']);
    }

    public function test_an_owner_and_the_admin_chat_and_each_side_is_alerted_once(): void
    {
        $this->actingAs($this->owner)->postJson(route('chat.store'), ['body' => 'Hello, how do I add a second house?'])
            ->assertCreated()->assertJsonPath('message.from_support', false);
        $this->postJson(route('chat.store'), ['body' => 'I paid by MoMo this morning.'])->assertCreated();

        // The admin gets one SMS and email, not one per line.
        Notification::assertSentToTimes($this->admin, NewChatMessage::class, 1);
        Notification::assertSentTo($this->admin, NewChatMessage::class, fn ($notification, $channels) => $channels === ['mail', SmsChannel::class]
            && str_contains($notification->toSms($this->admin), 'Jean Bosco'));

        $conversation = ChatConversation::sole();
        $this->actingAs($this->admin)->get(route('admin.chats'))
            ->assertInertia(fn ($page) => $page->component('Admin/Chats')->where('conversations.0.unread', 2)->where('auth.unreadChats', 1));

        // Opening the chat shows who wrote and marks it read.
        $this->getJson(route('admin.chats.show', $conversation))
            ->assertJsonCount(2, 'messages')
            ->assertJsonPath('person.name', 'Jean Bosco')
            ->assertJsonPath('person.phone', '0788123456');
        $this->assertSame(0, ChatMessage::query()->where('from_support', false)->whereNull('read_at')->count());

        $this->postJson(route('admin.chats.store', $conversation), ['body' => 'Open Subscription and choose Add houses.'])->assertCreated();
        Notification::assertSentTo($this->owner, NewChatMessage::class);

        // The owner sees the reply and the unread count goes back to zero once read.
        $this->actingAs($this->owner)->getJson(route('chat.index'))->assertJsonPath('unread', 1)->assertJsonCount(3, 'messages');
        $this->getJson(route('chat.index', ['after' => 2, 'read' => 1]))->assertJsonCount(1, 'messages')->assertJsonPath('messages.0.from_support', true);
        $this->getJson(route('chat.index'))->assertJsonPath('unread', 0);
    }

    public function test_files_are_private_and_empty_messages_are_refused(): void
    {
        $this->actingAs($this->owner)->postJson(route('chat.store'), ['body' => ''])->assertUnprocessable();
        $this->postJson(route('chat.store'), ['file' => UploadedFile::fake()->create('virus.exe', 10)])->assertUnprocessable();

        $id = $this->postJson(route('chat.store'), ['file' => UploadedFile::fake()->image('slip.jpg')])
            ->assertCreated()->assertJsonPath('message.attachment.image', true)->json('message.id');

        $this->get(route('chat.attachment', $id))->assertOk();
        $this->actingAs($this->admin)->get(route('chat.attachment', $id))->assertOk();
        $stranger = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $this->actingAs($stranger)->get(route('chat.attachment', $id))->assertNotFound();

        // Someone else's chat is never shown, and owners cannot open the admin pages.
        $this->getJson(route('chat.index'))->assertJsonCount(0, 'messages');
        $this->get(route('admin.chats'))->assertForbidden();
    }
}
