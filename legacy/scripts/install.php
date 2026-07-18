<?php

declare(strict_types=1);

/**
 * CLI installer: MongoDB indexes, default admin, sample data.
 *
 * Usage: php scripts/install.php
 */

$root = dirname(__DIR__);

$autoload = $root . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "Missing vendor/autoload.php\nRun: composer install\n");
    exit(1);
}
require_once $autoload;
require_once $root . '/includes/helpers.php';
bootstrap_app();

use App\Database;
use App\Support\Documents;
use MongoDB\Driver\Exception\ConnectionTimeoutException;

echo "Asokwa Pentecost Attendance — MongoDB installer\n";
echo str_repeat('-', 48) . "\n";

$config = require $root . '/config/database.php';
$uri = (string) $config['uri'];
$dbName = (string) $config['database'];

try {
    $db = Database::connection();
    // Ping
    $db->command(['ping' => 1]);
} catch (ConnectionTimeoutException $e) {
    fwrite(STDERR, "Cannot reach MongoDB at {$uri}: {$e->getMessage()}\n");
    exit(1);
} catch (Throwable $e) {
    fwrite(STDERR, "MongoDB error: {$e->getMessage()}\n");
    exit(1);
}

echo "Connected to MongoDB ({$uri}) · database `{$dbName}`\n";

/** @var array<string, list<array{keys: array<string, int>, options?: array<string, mixed>}>> $indexes */
$indexes = require $root . '/database/indexes.php';
foreach ($indexes as $collection => $defs) {
    $col = $db->selectCollection($collection);
    foreach ($defs as $def) {
        try {
            $col->createIndex($def['keys'], $def['options'] ?? []);
        } catch (Throwable $e) {
            fwrite(STDERR, "Index warning on {$collection}: {$e->getMessage()}\n");
        }
    }
    echo "Indexed collection: {$collection}\n";
}

$adminEmail = 'admin@asokwa.church';
$adminPass = 'Admin@12345';
$users = Database::collection('users');
$existing = $users->findOne(['email' => $adminEmail]);
$now = Documents::now();

if ($existing) {
    $users->updateOne(
        ['_id' => $existing['_id']],
        ['$set' => [
            'password_hash' => password_hash($adminPass, PASSWORD_DEFAULT),
            'full_name' => 'System Administrator',
            'role' => 'admin',
            'is_active' => true,
            'updated_at' => $now,
        ]]
    );
} else {
    $users->insertOne([
        'email' => $adminEmail,
        'password_hash' => password_hash($adminPass, PASSWORD_DEFAULT),
        'full_name' => 'System Administrator',
        'role' => 'admin',
        'is_active' => true,
        'member_id' => null,
        'last_login_at' => null,
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}
echo "Admin user ready: {$adminEmail} / {$adminPass}\n";

$services = Database::collection('services');
if ($services->countDocuments([]) === 0) {
    $sunday = new DateTimeImmutable('next sunday 09:00');
    $midweek = new DateTimeImmutable('next wednesday 18:00');
    $services->insertMany([
        [
            'title' => 'Sunday Morning Service',
            'service_type' => 'sunday',
            'location' => 'Main Auditorium',
            'starts_at' => Documents::date($sunday),
            'ends_at' => Documents::date($sunday->modify('+3 hours')),
            'late_after_minutes' => 15,
            'is_active' => true,
            'notes' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ],
        [
            'title' => 'Midweek Bible Study',
            'service_type' => 'midweek',
            'location' => 'Fellowship Hall',
            'starts_at' => Documents::date($midweek),
            'ends_at' => Documents::date($midweek->modify('+2 hours')),
            'late_after_minutes' => 10,
            'is_active' => true,
            'notes' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ],
    ]);
    echo "Seeded sample services\n";
}

$devices = Database::collection('devices');
if ($devices->countDocuments([]) === 0) {
    $token = 'dev-token-change-me';
    $devices->insertOne([
        'device_code' => 'KIOSK-MAIN-01',
        'name' => 'Main Entrance Kiosk',
        'location' => 'Main Auditorium Entrance',
        'device_token_hash' => hash('sha256', $token),
        'mode' => 'online',
        'last_seen_at' => null,
        'last_sync_at' => null,
        'roster_version' => null,
        'is_active' => true,
        'created_at' => $now,
        'updated_at' => $now,
    ]);
    echo "Seeded kiosk KIOSK-MAIN-01 (token: {$token})\n";
}

$envPath = $root . '/.env';
if (!is_file($envPath)) {
    copy($root . '/.env.example', $envPath);
    echo "Created .env from .env.example\n";
}

echo str_repeat('-', 48) . "\n";
echo "Done. Start with: php -S localhost:8080 -t public\n";
