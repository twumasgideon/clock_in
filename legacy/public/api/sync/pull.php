<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Database;
use App\Support\Documents;
use App\Sync\SyncService;

$deviceCode = (string) ($_GET['device_code'] ?? $_SERVER['HTTP_X_DEVICE_CODE'] ?? '');
$token = (string) ($_GET['device_token'] ?? $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? '');
$since = isset($_GET['since']) ? (string) $_GET['since'] : null;

if ($deviceCode !== '' && $token !== '') {
    $device = Documents::one(
        Database::collection('devices')->findOne(['device_code' => $deviceCode])
    );
    $tokenHash = hash('sha256', $token);
    $valid = $device
        && !empty($device['is_active'])
        && (hash_equals((string) $device['device_token_hash'], $tokenHash)
            || hash_equals((string) $device['device_token_hash'], $token));

    if (!$valid) {
        json_response(['ok' => false, 'error' => 'Unauthorized device'], 401);
    }

    Database::collection('devices')->updateOne(
        ['_id' => Documents::id($device['id'])],
        ['$set' => [
            'last_seen_at' => Documents::now(),
            'mode' => 'online',
            'updated_at' => Documents::now(),
        ]]
    );
}

$data = SyncService::buildPullPayload($since);
$data['ok'] = true;
json_response($data);
