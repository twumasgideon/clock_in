<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;
use App\Sync\SyncService;

Middleware::requireRole('admin');

$pageTitle = 'Devices & sync';
$activeNav = 'devices';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_post_csrf();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'register_device') {
        $code = trim((string) ($_POST['device_code'] ?? ''));
        $name = trim((string) ($_POST['name'] ?? ''));
        $token = trim((string) ($_POST['device_token'] ?? ''));
        if ($code && $name && $token) {
            $now = Documents::now();
            try {
                $result = Database::collection('devices')->insertOne([
                    'device_code' => $code,
                    'name' => $name,
                    'location' => trim((string) ($_POST['location'] ?? '')) ?: null,
                    'device_token_hash' => hash('sha256', $token),
                    'mode' => 'online',
                    'last_seen_at' => null,
                    'last_sync_at' => null,
                    'roster_version' => null,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                AuthService::audit('device.register', 'devices', (string) $result->getInsertedId());
                flash('success', 'Device registered. Store the token securely — it is not shown again.');
            } catch (Throwable $e) {
                flash('error', 'Could not register device (code may exist).');
            }
        } else {
            flash('error', 'Code, name, and token are required.');
        }
        redirect(url('pages/devices/index.php'));
    }

    if ($action === 'process_queue') {
        $pending = Documents::many(
            Database::collection('sync_queue')->find(
                ['status' => 'pending'],
                ['sort' => ['device_timestamp' => 1], 'limit' => 100]
            )
        );
        $applied = 0;
        foreach ($pending as $row) {
            $payload = is_array($row['payload'] ?? null) ? $row['payload'] : [];
            $memberId = (string) ($payload['member_id'] ?? '');
            $serviceId = (string) ($payload['service_id'] ?? '');
            $oid = Documents::id($row['id']);

            if ($memberId === '' || $serviceId === '' || !$oid) {
                Database::collection('sync_queue')->updateOne(
                    ['_id' => $oid],
                    ['$set' => ['status' => 'failed', 'last_error' => 'Invalid payload'], '$inc' => ['attempts' => 1]]
                );
                continue;
            }

            try {
                $ts = Documents::date((string) ($row['device_timestamp'] ?? 'now'));
                if (($row['event_type'] ?? '') === 'clock_out') {
                    Database::collection('attendance')->updateOne(
                        ['member_id' => $memberId, 'service_id' => $serviceId],
                        ['$set' => [
                            'clock_out_at' => $ts,
                            'synced_from_offline' => true,
                            'updated_at' => Documents::now(),
                        ]]
                    );
                } else {
                    $existing = Database::collection('attendance')->findOne([
                        'member_id' => $memberId,
                        'service_id' => $serviceId,
                    ]);
                    if ($existing) {
                        Database::collection('attendance')->updateOne(
                            ['_id' => $existing['_id']],
                            ['$set' => [
                                'clock_in_at' => $existing['clock_in_at'] ?? $ts,
                                'synced_from_offline' => true,
                                'updated_at' => Documents::now(),
                            ]]
                        );
                    } else {
                        $now = Documents::now();
                        Database::collection('attendance')->insertOne([
                            'member_id' => $memberId,
                            'service_id' => $serviceId,
                            'clock_in_at' => $ts,
                            'clock_out_at' => null,
                            'status' => $payload['status'] ?? 'present',
                            'verify_method' => 'offline_queue',
                            'source_mode' => 'offline',
                            'device_id' => $row['device_id'] ?? null,
                            'client_event_id' => $row['client_event_id'] ?? null,
                            'synced_from_offline' => true,
                            'notes' => null,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                }
                Database::collection('sync_queue')->updateOne(
                    ['_id' => $oid],
                    ['$set' => ['status' => 'synced', 'synced_at' => Documents::now()]]
                );
                $applied++;
            } catch (Throwable $e) {
                Database::collection('sync_queue')->updateOne(
                    ['_id' => $oid],
                    ['$set' => ['status' => 'failed', 'last_error' => substr($e->getMessage(), 0, 500)], '$inc' => ['attempts' => 1]]
                );
            }
        }
        flash('success', "Processed queue: {$applied} event(s) applied.");
        redirect(url('pages/devices/index.php'));
    }
}

$devices = Documents::many(
    Database::collection('devices')->find([], ['sort' => ['created_at' => -1]])
);

$queueRaw = Documents::many(
    Database::collection('sync_queue')->find([], ['sort' => ['received_at' => -1], 'limit' => 50])
);

$deviceNames = [];
foreach ($devices as $d) {
    $deviceNames[(string) $d['id']] = $d['name'];
}
$queue = [];
foreach ($queueRaw as $q) {
    $q['device_name'] = $deviceNames[(string) ($q['device_id'] ?? '')] ?? 'Unknown';
    $queue[] = $q;
}

$stats = SyncService::deviceStats();

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="stat-grid mb-4">
  <div class="stat-card">
    <div class="label">Devices</div>
    <p class="value"><?= (int) ($stats['total'] ?? 0) ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Online</div>
    <p class="value"><?= (int) ($stats['online_count'] ?? 0) ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Offline</div>
    <p class="value"><?= (int) ($stats['offline_count'] ?? 0) ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Pending queue</div>
    <p class="value"><?= SyncService::pendingCount() ?></p>
  </div>
</div>

<div class="row g-3">
  <div class="col-lg-4">
    <div class="panel-card mb-3">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Register kiosk</h2>
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="register_device">
        <div class="mb-2">
          <label class="form-label">Device code</label>
          <input class="form-control" name="device_code" required placeholder="KIOSK-SIDE-02">
        </div>
        <div class="mb-2">
          <label class="form-label">Name</label>
          <input class="form-control" name="name" required>
        </div>
        <div class="mb-2">
          <label class="form-label">Location</label>
          <input class="form-control" name="location">
        </div>
        <div class="mb-3">
          <label class="form-label">Device token (shown once)</label>
          <input class="form-control" name="device_token" required minlength="8">
        </div>
        <button class="btn btn-accent w-100" type="submit">Register</button>
      </form>
    </div>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="process_queue">
      <button class="btn btn-outline-secondary w-100" type="submit">Process pending sync queue</button>
    </form>
  </div>

  <div class="col-lg-8">
    <div class="panel-card mb-3">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Devices</h2>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Mode</th>
              <th>Last sync</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($devices as $d): ?>
              <tr>
                <td><?= e($d['device_code']) ?></td>
                <td><?= e($d['name']) ?></td>
                <td><span class="mode-badge mode-<?= e((string) $d['mode']) ?>"><?= e(ucfirst((string) $d['mode'])) ?></span></td>
                <td><?= !empty($d['last_sync_at']) ? e(date('M j g:i A', strtotime((string) $d['last_sync_at']))) : '—' ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-card">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Sync queue</h2>
      <?php if (!$queue): ?>
        <p class="empty-hint mb-0">Queue is empty.</p>
      <?php else: ?>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Device</th>
                <th>Event</th>
                <th>Status</th>
                <th>Device time</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($queue as $q): ?>
                <tr>
                  <td><?= e($q['device_name']) ?></td>
                  <td><?= e((string) $q['event_type']) ?></td>
                  <td><?= e((string) $q['status']) ?></td>
                  <td><?= e(date('M j g:i A', strtotime((string) $q['device_timestamp']))) ?></td>
                  <td><?= e(date('M j g:i A', strtotime((string) $q['received_at']))) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </div>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
