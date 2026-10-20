<?php

/*
 * ITUZE Android app (Trusted Web Activity of the live site). The package id
 * and the signing key's SHA-256 fingerprint prove the app belongs to this
 * site, so it opens full screen without a browser bar.
 */
return [
    'package' => env('ANDROID_APP_PACKAGE', 'com.qragroup.ituze'),
    'sha256_fingerprints' => array_filter(explode(',', env(
        'ANDROID_APP_SHA256',
        'E8:1C:E8:E7:8A:65:71:29:4C:0A:C2:30:B3:A9:24:18:55:87:0E:0B:0B:28:56:7C:A6:30:92:7B:53:FF:CB:43',
    ))),
];
