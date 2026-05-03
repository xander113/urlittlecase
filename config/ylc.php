<?php

return [
    /*
    |--------------------------------------------------------------------------
    | YourLittleCase! — Application Configuration
    |--------------------------------------------------------------------------
    */

    'name' => 'Ur Little Case',

    // Currency
    'currency' => [
        'name'         => 'YAN',
        'symbol'       => 'YN',
        'new_user_grant' => 50, // Starting balance for new users
        'max_per_trade'  => 100_000_000,
        'max_list_price' => 999_999_999,
    ],

    // Trading
    'trade' => [
        'max_items_per_side' => 4,
        'expire_hours'       => 72,
        'max_pending'        => 10,
    ],

    // Market
    'market' => [
        'min_price'       => 1,
        'max_price'       => 999_999_999,
        'tax_rate'        => 0.30, // 30% marketplace tax (goes to system)
        'tax_enabled'     => true,
    ],

    // RAP
    'rap' => [
        'window_sales' => 30, // last N sales averaged
    ],

    // Avatar
    'avatar' => [
        'slots'     => ['hat', 'face', 'shirt', 'pants', 'shoes', 'accessory'],
        'body_colors' => [
            '#f5cba7', '#fad7a0', '#d7bde2', '#a9cce3',
            '#a9dfbf', '#f1948a', '#f7dc6f', '#aed6f1',
            '#c0c0c0', '#808080', '#4a4a4a', '#1a1a1a',
        ],
    ],

    // RCC
    'rcc' => [
        'enabled'       => true,
        'canvas_size'   => 420,
        'obj_path'      => public_path('models/character_model.obj'),
        'output_disk'   => 'public',
    ],

    // Rate limiting (used alongside DDoSProtection middleware)
    'rate_limit' => [
        'ip_per_minute'   => 200,
        'user_per_minute' => 120,
        'sensitive_ratio' => 0.4,
    ],

    // Staff
    'staff' => [
        'roles'              => ['moderator', 'admin'],
        'admin_email'        => env('ADMIN_EMAIL', 'admin@yourlittlecase.com'),
        'report_spam_window' => 60, // minutes before allowing another report
        'max_reports_window' => 3,
    ],
];
