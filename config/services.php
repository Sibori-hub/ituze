<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    /*
     * Mobile money "request to pay": the tenant gets a prompt on their phone and
     * approves with their PIN.
     *
     * driver: "fake" simulates payments locally (no account needed);
     *         "mtn"  uses the MTN MoMo Collections API (sandbox or live).
     * MTN sandbox: subscribe to "Collections" at https://momodeveloper.mtn.com,
     * put the primary key in MTN_MOMO_SUBSCRIPTION_KEY, then run
     * `php artisan momo:sandbox-user` to create the API user and key.
     */
    'mobile_money' => [
        'driver' => env('MOBILE_MONEY_DRIVER', 'fake'),
        // How long the tenant has to approve before the request is treated as expired.
        'timeout_seconds' => (int) env('MOBILE_MONEY_TIMEOUT', 180),
        // Fake driver: seconds before a request is approved. Numbers ending in 0000 decline.
        'fake_delay_seconds' => (int) env('MOBILE_MONEY_FAKE_DELAY', 8),
        'mtn' => [
            'base_url' => env('MTN_MOMO_BASE_URL', 'https://sandbox.momodeveloper.mtn.com'),
            // "sandbox" for testing; MTN gives the live value (e.g. "mtnrwanda") at go-live.
            'environment' => env('MTN_MOMO_ENVIRONMENT', 'sandbox'),
            // The sandbox only accepts EUR; live Rwanda uses RWF.
            'currency' => env('MTN_MOMO_CURRENCY', 'EUR'),
            'subscription_key' => env('MTN_MOMO_SUBSCRIPTION_KEY'),
            'api_user' => env('MTN_MOMO_API_USER'),
            'api_key' => env('MTN_MOMO_API_KEY'),
        ],
    ],

    // SMS alerts (new inquiries). "log" only writes to the log until a provider is set up.
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'default_country_code' => env('SMS_DEFAULT_COUNTRY_CODE', '250'),
        'pindo' => [
            'token' => env('PINDO_API_TOKEN'),
            'sender' => env('PINDO_SENDER', 'PindoTest'),
        ],
        'africastalking' => [
            'username' => env('AFRICASTALKING_USERNAME'),
            'api_key' => env('AFRICASTALKING_API_KEY'),
            'sender' => env('AFRICASTALKING_SENDER'),
        ],
    ],

    'whatsapp' => [
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
        'graph_version' => env('WHATSAPP_GRAPH_VERSION', 'v22.0'),

        // OTP delivery. Business-initiated messages need an approved template,
        // so set WHATSAPP_OTP_TEMPLATE to the name of your authentication template.
        // Leave it empty to fall back to a plain text message (works only inside
        // the 24-hour customer service window).
        'otp_template' => env('WHATSAPP_OTP_TEMPLATE'),
        'otp_template_language' => env('WHATSAPP_OTP_TEMPLATE_LANGUAGE', 'en'),
        'otp_template_has_button' => env('WHATSAPP_OTP_TEMPLATE_BUTTON', false),
        'default_country_code' => env('WHATSAPP_DEFAULT_COUNTRY_CODE', '250'),
    ],

];
