<?php

declare(strict_types=1);

/**
 * MongoDB document shapes (reference).
 *
 * Database: apc_attendance
 * Driver:   ext-mongodb + mongodb/mongodb
 *
 * Collections:
 *   users, members, services, attendance, devices,
 *   sync_queue, biometric_templates, audit_logs, notifications
 *
 * See database/indexes.php for unique/index definitions.
 * Run: php scripts/install.php
 */

return [
    'users' => [
        'email' => 'string unique',
        'password_hash' => 'string',
        'full_name' => 'string',
        'role' => 'admin|officer|pastor|member',
        'is_active' => 'bool',
        'member_id' => 'string|null',
        'last_login_at' => 'UTCDateTime|null',
        'created_at' => 'UTCDateTime',
        'updated_at' => 'UTCDateTime',
    ],
    'members' => [
        'member_code' => 'string unique',
        'first_name' => 'string',
        'last_name' => 'string',
        'other_names' => 'string|null',
        'gender' => 'male|female|other|null',
        'date_of_birth' => 'string|null',
        'phone' => 'string|null',
        'email' => 'string|null',
        'address' => 'string|null',
        'photo_path' => 'string|null',
        'membership_status' => 'active|inactive|transferred|deceased',
        'enrolled_face' => 'bool',
        'enrolled_fingerprint' => 'bool',
        'face_template_ref' => 'string|null',
        'fingerprint_template_ref' => 'string|null',
        'notes' => 'string|null',
        'created_at' => 'UTCDateTime',
        'updated_at' => 'UTCDateTime',
        'synced_at' => 'UTCDateTime|null',
    ],
    'services' => [
        'title' => 'string',
        'service_type' => 'sunday|midweek|special|event',
        'location' => 'string|null',
        'starts_at' => 'UTCDateTime',
        'ends_at' => 'UTCDateTime|null',
        'late_after_minutes' => 'int',
        'is_active' => 'bool',
        'notes' => 'string|null',
        'created_at' => 'UTCDateTime',
        'updated_at' => 'UTCDateTime',
    ],
    'attendance' => [
        'member_id' => 'string',
        'service_id' => 'string',
        'clock_in_at' => 'UTCDateTime|null',
        'clock_out_at' => 'UTCDateTime|null',
        'status' => 'present|late|absent|partial',
        'verify_method' => 'face_fingerprint|face|fingerprint|manual|offline_queue',
        'source_mode' => 'online|offline',
        'device_id' => 'string|null',
        'client_event_id' => 'string|null',
        'synced_from_offline' => 'bool',
        'notes' => 'string|null',
        'created_at' => 'UTCDateTime',
        'updated_at' => 'UTCDateTime',
    ],
    'devices' => [
        'device_code' => 'string unique',
        'name' => 'string',
        'location' => 'string|null',
        'device_token_hash' => 'string',
        'mode' => 'online|offline|syncing',
        'last_seen_at' => 'UTCDateTime|null',
        'last_sync_at' => 'UTCDateTime|null',
        'roster_version' => 'string|null',
        'is_active' => 'bool',
        'created_at' => 'UTCDateTime',
        'updated_at' => 'UTCDateTime',
    ],
    'sync_queue' => [
        'device_id' => 'string',
        'client_event_id' => 'string',
        'event_type' => 'clock_in|clock_out|heartbeat|roster_ack',
        'payload' => 'object',
        'status' => 'pending|processing|synced|failed|duplicate',
        'attempts' => 'int',
        'last_error' => 'string|null',
        'device_timestamp' => 'UTCDateTime',
        'received_at' => 'UTCDateTime',
        'synced_at' => 'UTCDateTime|null',
    ],
];
