<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        $this->configurePasswordPolicy();
    }

    /**
     * Strengthen every password validated with Password::defaults().
     */
    protected function configurePasswordPolicy(): void
    {
        Password::defaults(function () {
            $rule = Password::min(10)->mixedCase()->numbers()->symbols();

            // The breach lookup calls an external API; only run it in production
            // so offline development and the test suite stay deterministic.
            return app()->isProduction() ? $rule->uncompromised() : $rule;
        });
    }
}
