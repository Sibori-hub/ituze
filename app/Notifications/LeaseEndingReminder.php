<?php

namespace App\Notifications;

use App\Models\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Lease is ending (60, 30 or 7 days) or has expired without a renewal.
 * $audience is "tenant" or "staff" (admins and the owner).
 */
class LeaseEndingReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Tenancy $tenancy, public string $kind, public string $audience)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $lines = self::lines($this->tenancy, $this->kind, $this->audience);
        $mail = (new MailMessage)
            ->subject($lines['subject'])
            ->greeting($lines['greeting']);

        foreach ($lines['body'] as $line) {
            $mail->line($line);
        }

        if ($this->audience === 'staff') {
            $mail->action('Manage lease', url('/leases?status='.($this->kind === 'expired' ? 'expired' : 'ending_soon')));
        }

        return $mail->line('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /**
     * Same wording for email and WhatsApp.
     *
     * @return array{subject: string, greeting: string, body: list<string>}
     */
    public static function lines(Tenancy $tenancy, string $kind, string $audience): array
    {
        $tenancy->loadMissing(['tenant', 'unit.property']);
        $room = 'room '.$tenancy->unit?->unit_number.' at '.$tenancy->unit?->property?->name;
        $end = $tenancy->end_date?->format('j M Y');
        $days = (int) now()->startOfDay()->diffInDays($tenancy->end_date->copy()->startOfDay(), false);
        $when = match (true) {
            $days > 1 => "in {$days} days ({$end})",
            $days === 1 => "tomorrow ({$end})",
            $days === 0 => "today ({$end})",
            default => "on {$end}",
        };

        if ($audience === 'tenant') {
            return [
                'subject' => 'Your lease ends '.$when,
                'greeting' => 'Hello '.$tenancy->tenant?->name.',',
                'body' => [
                    "Your lease for {$room} ends {$when}.",
                    'If you would like to stay, contact ITUZE GREEN PLATFORM to renew. The first month of the new lease is paid when you sign, and your deposit carries forward.',
                    'If you are moving out, please tell us so we can arrange the inspection and your deposit refund.',
                ],
            ];
        }

        if ($kind === 'expired') {
            return [
                'subject' => 'Action needed: lease expired for '.$tenancy->tenant?->name,
                'greeting' => 'Hello,',
                'body' => [
                    "The lease of {$tenancy->tenant?->name} for {$room} ended {$when} and has not been renewed.",
                    'No new rent is charged until it is renewed. Please renew the lease or arrange the move-out.',
                ],
            ];
        }

        return [
            'subject' => 'Lease ending '.$when.': '.$tenancy->tenant?->name,
            'greeting' => 'Hello,',
            'body' => [
                "The lease of {$tenancy->tenant?->name} for {$room} ends {$when}.",
                'Contact the tenant to renew it or plan the move-out.',
            ],
        ];
    }
}
