<?php

return [

    /*
    | Key that external systems (for example a ticket scanner at the venue
    | door) must send in the X-API-Key header. The real value lives in .env.
    */
    'api_key' => env('EVENTHUB_API_KEY'),

    /*
    | Third-party QR code service (goQR.me). Docs: https://goqr.me/api/
    */
    'qr_api_url' => env('QR_API_URL', 'https://api.qrserver.com/v1/create-qr-code/'),

];
