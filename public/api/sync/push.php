<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Sync\SyncService;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'POST required'], 405);
}

$raw = file_get_contents('php://input') ?: '';
try {
    $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable) {
    json_response(['ok' => false, 'error' => 'Invalid JSON'], 400);
}

if (!is_array($payload)) {
    json_response(['ok' => false, 'error' => 'Invalid payload'], 400);
}

$result = SyncService::acceptPush($payload);
json_response($result, $result['ok'] ? 200 : 400);
