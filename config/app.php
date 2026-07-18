<?php

declare(strict_types=1);

/**
 * Application configuration for Asokwa Pentecost Church Attendance System.
 */
return [
    'name' => 'Asokwa Pentecost Attendance',
    'short_name' => 'APC Attendance',
    'church' => 'Asokwa Pentecost Church',
    'env' => getenv('APP_ENV') ?: 'local',
    'debug' => (getenv('APP_DEBUG') ?: 'true') === 'true',
    'url' => getenv('APP_URL') ?: 'http://localhost:8080',
    'timezone' => 'Africa/Accra',
    'session_name' => 'apc_attendance_session',
    'database_driver' => 'mongodb',
    'biometric' => [
        'require_face' => true,
        'require_fingerprint' => true,
        'match_timeout_ms' => 3000,
    ],
    'sync' => [
        // Dual-mode: online live write + offline queue with push on reconnect
        'mode' => 'hybrid', // hybrid | online_only | offline_first
        'queue_batch_size' => 50,
        'pull_interval_seconds' => 120,
        'conflict_policy' => 'server_wins_profile_merge_attendance',
        'duplicate_window_seconds' => 90,
        'device_token_ttl_days' => 90,
    ],
    'roles' => [
        'admin' => 'Administrator',
        'officer' => 'Attendance Officer',
        'pastor' => 'Pastor',
        'member' => 'Member',
    ],
];
