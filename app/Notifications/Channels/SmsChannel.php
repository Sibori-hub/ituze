<?php

namespace App\Notifications\Channels;

use App\Services\SmsService;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Notification channel for SMS. The notification provides toSms(); the phone
 * comes from routeNotificationForSms() or the notifiable's "phone".
 * A failed SMS is logged and never stops the email from going out.
 */
class SmsChannel
{
    public function __construct(private SmsService $sms)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        $phone = method_exists($notifiable, 'routeNotificationFor')
            ? ($notifiable->routeNotificationFor('sms', $notification) ?? $notifiable->phone ?? null)
            : ($notifiable->phone ?? null);

        // Sample or demo accounts whose phone may belong to someone else get no SMS.
        if (blank($phone) || ! method_exists($notification, 'toSms') || ($notifiable->sms_muted ?? false)) {
            return;
        }

        try {
            $this->sms->send((string) $phone, $notification->toSms($notifiable));
        } catch (Throwable $e) {
            Log::warning('SMS failed: '.$e->getMessage(), ['to' => $phone, 'notification' => $notification::class]);
        }
    }
}
