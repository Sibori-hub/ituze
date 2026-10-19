<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Legal Document Version
    |--------------------------------------------------------------------------
    |
    | Bump this whenever the Terms or Privacy Policy change. The value is stored
    | against each account so we can prove which version a user accepted, and so
    | we can later force re-acceptance of a newer revision.
    |
    */

    'terms_version' => '2026-10-09',

    'terms_updated_at' => 'October 9, 2026',

    /*
    |--------------------------------------------------------------------------
    | Company Details
    |--------------------------------------------------------------------------
    */

    'company_name' => 'Ituze Green Platform',
    'operator' => 'Q.R.A GROUP Ltd',
    'contact_email' => 'info@qraltd.com',
    'contact_phone' => '0789265436',
    'contact_address' => 'ULK-KAGUGU Road, Source Oil Plaza, 1st Floor, Gisozi, Gasabo, Kigali-Rwanda',

    /*
    |--------------------------------------------------------------------------
    | Advertising Pricing (used from the advertiser phase onward)
    |--------------------------------------------------------------------------
    */

    'ad_unit_price_rwf' => 25000,
    'ad_welcome_bonus_units' => 3,

    // Self-registered owners: monthly subscription, paid 1, 3, 6 or 12 months at a time.
    'owner_subscription_monthly_rwf' => (int) env('OWNER_SUBSCRIPTION_MONTHLY_RWF', 100000),
    'owner_subscription_month_options' => [1, 3, 6, 12],
    // Days after the paid-until date before the owner (and their managers) are blocked.
    'owner_subscription_grace_days' => 7,

    // Where owners send subscription payments by bank transfer (shown on the payment page).
    'qra_bank' => [
        'bank' => env('QRA_BANK_NAME'),
        'account_name' => env('QRA_BANK_ACCOUNT_NAME', 'Q.R.A GROUP LTD'),
        'account_number' => env('QRA_BANK_ACCOUNT_NUMBER'),
    ],

];
