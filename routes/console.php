<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tenancies:activate-scheduled')->dailyAt('00:05')->withoutOverlapping();
Schedule::command('rent:generate-charges')->dailyAt('00:10')->withoutOverlapping();
