<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tenancies:activate-scheduled')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('tenancies:complete-apartment-stays')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('rent:generate-charges')->dailyAt('00:10')->withoutOverlapping();
Schedule::command('leases:send-reminders')->dailyAt('08:00')->withoutOverlapping();
Schedule::command('subscriptions:send-reminders')->dailyAt('08:05')->withoutOverlapping();
