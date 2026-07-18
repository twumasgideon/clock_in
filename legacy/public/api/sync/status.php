<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Sync\SyncService;

json_response([
    'ok' => true,
    'pending' => SyncService::pendingCount(),
    'devices' => SyncService::deviceStats(),
    'failures' => SyncService::recentFailures(5),
    'server_time' => date('c'),
]);
