<?php

declare(strict_types=1);

namespace App\Sync;

/**
 * Sync contract for hybrid online/offline kiosk operation.
 *
 * Online:  attendance writes go to MongoDB immediately.
 * Offline: kiosk appends to local SyncQueue, then POST /api/sync/push on reconnect.
 * Pull:    kiosk GET /api/sync/pull for roster + biometric template refs.
 */
final class SyncContract
{
    public const MODE_ONLINE = 'online';
    public const MODE_OFFLINE = 'offline';
    public const MODE_SYNCING = 'syncing';

    public const EVENT_CLOCK_IN = 'clock_in';
    public const EVENT_CLOCK_OUT = 'clock_out';
    public const EVENT_HEARTBEAT = 'heartbeat';
    public const EVENT_ROSTER_ACK = 'roster_ack';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SYNCED = 'synced';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DUPLICATE = 'duplicate';

    /**
     * @return array<string, mixed>
     */
    public static function pushSchema(): array
    {
        return [
            'device_code' => 'string',
            'device_token' => 'string',
            'events' => [
                [
                    'client_event_id' => 'uuid',
                    'event_type' => 'clock_in|clock_out|heartbeat|roster_ack',
                    'device_timestamp' => 'ISO-8601',
                    'payload' => [
                        'member_id' => 'string',
                        'service_id' => 'string',
                        'verify_method' => 'face_fingerprint|face|fingerprint|manual|offline_queue',
                        'status' => 'present|late|partial',
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function pullSchema(): array
    {
        return [
            'roster_version' => 'string',
            'server_time' => 'ISO-8601',
            'members' => [
                [
                    'id' => 'string',
                    'member_code' => 'string',
                    'first_name' => 'string',
                    'last_name' => 'string',
                    'membership_status' => 'active|inactive|...',
                    'enrolled_face' => 'bool',
                    'enrolled_fingerprint' => 'bool',
                    'face_template_ref' => 'string|null',
                    'fingerprint_template_ref' => 'string|null',
                    'updated_at' => 'ISO-8601',
                ],
            ],
            'services' => [
                [
                    'id' => 'string',
                    'title' => 'string',
                    'starts_at' => 'ISO-8601',
                    'ends_at' => 'ISO-8601|null',
                    'late_after_minutes' => 'int',
                    'is_active' => 'bool',
                ],
            ],
            'conflict_policy' => 'server_wins_profile_merge_attendance',
        ];
    }

    public static function conflictPolicy(): string
    {
        $config = require dirname(__DIR__, 2) . '/config/app.php';
        return $config['sync']['conflict_policy'];
    }

    public static function duplicateWindowSeconds(): int
    {
        $config = require dirname(__DIR__, 2) . '/config/app.php';
        return (int) $config['sync']['duplicate_window_seconds'];
    }
}
