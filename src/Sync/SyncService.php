<?php

declare(strict_types=1);

namespace App\Sync;

use App\Database;
use App\Support\Documents;

final class SyncService
{
    public static function pendingCount(?string $deviceId = null): int
    {
        $filter = ['status' => ['$in' => ['pending', 'processing', 'failed']]];
        if ($deviceId !== null) {
            $filter['device_id'] = $deviceId;
        }
        return (int) Database::collection('sync_queue')->countDocuments($filter);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function recentFailures(int $limit = 10): array
    {
        $rows = Documents::many(
            Database::collection('sync_queue')->find(
                ['status' => 'failed'],
                ['sort' => ['received_at' => -1], 'limit' => $limit]
            )
        );

        $deviceIds = array_values(array_unique(array_filter(array_column($rows, 'device_id'))));
        $names = [];
        if ($deviceIds) {
            foreach (Documents::many(Database::collection('devices')->find([
                '_id' => ['$in' => array_values(array_filter(array_map([Documents::class, 'id'], $deviceIds)))],
            ])) as $device) {
                $names[(string) $device['id']] = $device['name'];
            }
        }

        foreach ($rows as &$row) {
            $row['device_name'] = $names[(string) ($row['device_id'] ?? '')] ?? 'Unknown';
        }
        unset($row);

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    public static function deviceStats(): array
    {
        $devices = Documents::many(
            Database::collection('devices')->find(['is_active' => true])
        );

        $online = 0;
        $offline = 0;
        $syncing = 0;
        $lastSync = null;

        foreach ($devices as $d) {
            $mode = $d['mode'] ?? 'online';
            if ($mode === 'online') {
                $online++;
            } elseif ($mode === 'offline') {
                $offline++;
            } elseif ($mode === 'syncing') {
                $syncing++;
            }
            if (!empty($d['last_sync_at'])) {
                if ($lastSync === null || (string) $d['last_sync_at'] > (string) $lastSync) {
                    $lastSync = $d['last_sync_at'];
                }
            }
        }

        return [
            'total' => count($devices),
            'online_count' => $online,
            'offline_count' => $offline,
            'syncing_count' => $syncing,
            'last_sync_at' => $lastSync,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public static function acceptPush(array $payload): array
    {
        $deviceCode = (string) ($payload['device_code'] ?? '');
        $token = (string) ($payload['device_token'] ?? '');
        $events = $payload['events'] ?? [];

        if ($deviceCode === '' || $token === '' || !is_array($events)) {
            return ['ok' => false, 'error' => 'Invalid push payload'];
        }

        $device = Documents::one(
            Database::collection('devices')->findOne(['device_code' => $deviceCode])
        );

        if (!$device || empty($device['is_active'])) {
            return ['ok' => false, 'error' => 'Unknown or inactive device'];
        }

        $tokenHash = hash('sha256', $token);
        if (!hash_equals((string) $device['device_token_hash'], $tokenHash)
            && !hash_equals((string) $device['device_token_hash'], $token)) {
            return ['ok' => false, 'error' => 'Invalid device token'];
        }

        $inserted = 0;
        $duplicates = 0;

        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }
            $clientId = (string) ($event['client_event_id'] ?? '');
            $type = (string) ($event['event_type'] ?? '');
            if ($clientId === '' || $type === '') {
                continue;
            }

            $existing = Database::collection('sync_queue')->findOne([
                'device_id' => (string) $device['id'],
                'client_event_id' => $clientId,
            ]);

            if ($existing) {
                Database::collection('sync_queue')->updateOne(
                    ['_id' => $existing['_id']],
                    ['$inc' => ['attempts' => 1]]
                );
                $duplicates++;
                continue;
            }

            try {
                Database::collection('sync_queue')->insertOne([
                    'device_id' => (string) $device['id'],
                    'client_event_id' => $clientId,
                    'event_type' => $type,
                    'payload' => $event['payload'] ?? [],
                    'status' => SyncContract::STATUS_PENDING,
                    'attempts' => 0,
                    'last_error' => null,
                    'device_timestamp' => Documents::date((string) ($event['device_timestamp'] ?? 'now')),
                    'received_at' => Documents::now(),
                    'synced_at' => null,
                ]);
                $inserted++;
            } catch (\Throwable $e) {
                return ['ok' => false, 'error' => $e->getMessage(), 'accepted' => $inserted];
            }
        }

        Database::collection('devices')->updateOne(
            ['_id' => Documents::id($device['id'])],
            ['$set' => [
                'mode' => 'syncing',
                'last_seen_at' => Documents::now(),
                'last_sync_at' => Documents::now(),
                'updated_at' => Documents::now(),
            ]]
        );

        return [
            'ok' => true,
            'accepted' => $inserted,
            'duplicates' => $duplicates,
            'conflict_policy' => SyncContract::conflictPolicy(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function buildPullPayload(?string $since = null): array
    {
        $memberFilter = ['membership_status' => 'active'];
        if ($since) {
            $memberFilter['updated_at'] = ['$gt' => Documents::date($since)];
        }

        $members = Documents::many(
            Database::collection('members')->find(
                $memberFilter,
                [
                    'sort' => ['updated_at' => 1],
                    'limit' => 1000,
                    'projection' => [
                        'member_code' => 1,
                        'first_name' => 1,
                        'last_name' => 1,
                        'membership_status' => 1,
                        'enrolled_face' => 1,
                        'enrolled_fingerprint' => 1,
                        'face_template_ref' => 1,
                        'fingerprint_template_ref' => 1,
                        'updated_at' => 1,
                    ],
                ]
            )
        );

        $dayAgo = Documents::date((new \DateTimeImmutable('-1 day'))->format('c'));
        $services = Documents::many(
            Database::collection('services')->find(
                [
                    'is_active' => true,
                    'starts_at' => ['$gte' => $dayAgo],
                ],
                [
                    'sort' => ['starts_at' => 1],
                    'limit' => 50,
                    'projection' => [
                        'title' => 1,
                        'service_type' => 1,
                        'starts_at' => 1,
                        'ends_at' => 1,
                        'late_after_minutes' => 1,
                        'is_active' => 1,
                    ],
                ]
            )
        );

        $version = hash('sha256', json_encode([
            'members' => count($members),
            'services' => count($services),
            'ts' => date('c'),
        ], JSON_THROW_ON_ERROR));

        return [
            'roster_version' => $version,
            'server_time' => date('c'),
            'members' => $members,
            'services' => $services,
            'conflict_policy' => SyncContract::conflictPolicy(),
            'schema' => SyncContract::pullSchema(),
        ];
    }
}
