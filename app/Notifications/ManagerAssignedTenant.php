<?php

namespace App\Notifications;

use App\Models\Tenancy;
use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A manager rented a unit to a tenant. Tells the owner by email and SMS who,
 * where, for what use, the rent, and the money received (rent and deposit apart).
 */
class ManagerAssignedTenant extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $managerName,
        public string $tenantName,
        public string $propertyName,
        public string $unitNumber,
        public ?string $businessUse,
        public float $monthlyRent,
        public float $rentReceived,
        public float $depositReceived,
        public string $method,
        public string $startDate,
        public string $endDate,
        public int $tenancyId,
        public int $propertyId,
        public int $unitId,
    ) {
        $this->onConnection('deferred');
    }

    public static function for(User $manager, Tenancy $tenancy, float $rentReceived, float $depositReceived, string $method): self
    {
        $tenancy->loadMissing('tenant', 'unit.property');

        return new self(
            $manager->name, (string) $tenancy->tenant?->name, (string) $tenancy->unit?->property?->name, (string) $tenancy->unit?->unit_number,
            $tenancy->business_use, (float) $tenancy->monthly_rent, $rentReceived, $depositReceived, $method,
            $tenancy->start_date?->format('j M Y') ?? '', $tenancy->end_date?->format('j M Y') ?? '',
            $tenancy->id, (int) $tenancy->unit?->property_id, (int) $tenancy->unit_id,
        );
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter([
            filled($notifiable->email ?? null) ? 'mail' : null,
            filled($notifiable->phone ?? null) ? SmsChannel::class : null,
        ]));
    }

    private function rwf(float $amount): string
    {
        return number_format($amount).' RWF';
    }

    public function toMail(object $notifiable): MailMessage
    {
        $method = str_replace('_', ' ', $this->method);

        return (new MailMessage)
            ->subject('New tenant at '.$this->propertyName.' · unit '.$this->unitNumber)
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line('Your manager **'.$this->managerName.'** rented unit **'.$this->unitNumber.'** at **'.$this->propertyName.'** to **'.$this->tenantName.'**'.($this->businessUse ? ' (used as '.$this->businessUse.')' : '').'.')
            ->line('Lease: '.$this->startDate.' to '.$this->endDate.' · rent '.$this->rwf($this->monthlyRent).' a month.')
            ->line('Money received ('.$method.'):')
            ->line('• Rent: **'.$this->rwf($this->rentReceived).'**')
            ->line('• Security deposit: **'.$this->rwf($this->depositReceived).'** (the tenant\'s money, refundable at move-out)')
            ->line('• Total: **'.$this->rwf($this->rentReceived + $this->depositReceived).'**')
            ->action('See the unit', route('properties.units.show', [$this->propertyId, $this->unitId]))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return 'ITUZE: '.str($this->managerName)->limit(15, '').' rented '.str($this->propertyName)->limit(18, '').' unit '.$this->unitNumber
            .' to '.str($this->tenantName)->limit(18, '').'. Rent '.number_format($this->rentReceived).' + deposit '.number_format($this->depositReceived).' RWF.';
    }
}
