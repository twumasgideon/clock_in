<?php

declare(strict_types=1);

/**
 * MongoDB collection indexes for the attendance system.
 *
 * @return array<string, list<array{keys: array<string, int>, options?: array<string, mixed>}>>
 */
return [
    'users' => [
        ['keys' => ['email' => 1], 'options' => ['unique' => true]],
        ['keys' => ['role' => 1]],
        ['keys' => ['member_id' => 1]],
    ],
    'members' => [
        ['keys' => ['member_code' => 1], 'options' => ['unique' => true]],
        ['keys' => ['last_name' => 1, 'first_name' => 1]],
        ['keys' => ['membership_status' => 1]],
        ['keys' => ['phone' => 1]],
        ['keys' => ['updated_at' => 1]],
    ],
    'services' => [
        ['keys' => ['starts_at' => -1]],
        ['keys' => ['is_active' => 1, 'starts_at' => 1]],
    ],
    'attendance' => [
        ['keys' => ['member_id' => 1, 'service_id' => 1], 'options' => ['unique' => true]],
        ['keys' => ['client_event_id' => 1], 'options' => ['unique' => true, 'sparse' => true]],
        ['keys' => ['service_id' => 1]],
        ['keys' => ['clock_in_at' => -1]],
        ['keys' => ['status' => 1]],
        ['keys' => ['source_mode' => 1]],
    ],
    'devices' => [
        ['keys' => ['device_code' => 1], 'options' => ['unique' => true]],
        ['keys' => ['is_active' => 1]],
    ],
    'sync_queue' => [
        ['keys' => ['device_id' => 1, 'client_event_id' => 1], 'options' => ['unique' => true]],
        ['keys' => ['status' => 1]],
        ['keys' => ['received_at' => -1]],
        ['keys' => ['device_timestamp' => 1]],
    ],
    'biometric_templates' => [
        ['keys' => ['member_id' => 1, 'modality' => 1], 'options' => ['unique' => true]],
    ],
    'audit_logs' => [
        ['keys' => ['action' => 1]],
        ['keys' => ['created_at' => -1]],
    ],
    'notifications' => [
        ['keys' => ['status' => 1]],
        ['keys' => ['user_id' => 1]],
    ],
];
