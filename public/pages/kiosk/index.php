<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer');

$pageTitle = 'Attendance kiosk';
$activeNav = 'kiosk';

$sixHoursAgo = Documents::date((new DateTimeImmutable('-6 hours'))->format('c'));

$services = Documents::many(
    Database::collection('services')->find(
        ['is_active' => true, 'starts_at' => ['$gte' => $sixHoursAgo]],
        ['sort' => ['starts_at' => 1], 'limit' => 20]
    )
);

$members = Documents::many(
    Database::collection('members')->find(
        ['membership_status' => 'active'],
        ['sort' => ['last_name' => 1, 'first_name' => 1], 'limit' => 500]
    )
);

$device = Documents::one(
    Database::collection('devices')->findOne(
        ['is_active' => true],
        ['sort' => ['created_at' => 1]]
    )
);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_post_csrf();
    $action = (string) ($_POST['action'] ?? 'clock_in');
    $memberId = (string) ($_POST['member_id'] ?? '');
    $serviceId = (string) ($_POST['service_id'] ?? '');
    $forceOffline = isset($_POST['force_offline']);

    if ($memberId === '' || $serviceId === '' || !Documents::id($memberId) || !Documents::id($serviceId)) {
        flash('error', 'Select a member and service.');
        redirect(url('pages/kiosk/index.php'));
    }

    $isOffline = $forceOffline || (isset($_POST['client_mode']) && $_POST['client_mode'] === 'offline');
    $clientEventId = (string) ($_POST['client_event_id'] ?? '');
    if ($clientEventId === '') {
        $clientEventId = bin2hex(random_bytes(16));
    }

    if ($isOffline) {
        $payload = [
            'member_id' => $memberId,
            'service_id' => $serviceId,
            'verify_method' => 'manual',
            'status' => 'present',
            'action' => $action,
        ];
        if ($device) {
            $existing = Database::collection('sync_queue')->findOne([
                'device_id' => (string) $device['id'],
                'client_event_id' => $clientEventId,
            ]);
            if (!$existing) {
                Database::collection('sync_queue')->insertOne([
                    'device_id' => (string) $device['id'],
                    'client_event_id' => $clientEventId,
                    'event_type' => $action === 'clock_out' ? 'clock_out' : 'clock_in',
                    'payload' => $payload,
                    'status' => 'pending',
                    'attempts' => 0,
                    'last_error' => null,
                    'device_timestamp' => Documents::now(),
                    'received_at' => Documents::now(),
                    'synced_at' => null,
                ]);
            } else {
                Database::collection('sync_queue')->updateOne(
                    ['_id' => $existing['_id']],
                    ['$inc' => ['attempts' => 1]]
                );
            }
            AuthService::audit('kiosk.offline_queue', 'sync_queue', null, $payload);
            flash('info', 'Queued offline. Will apply when sync processes the event.');
        } else {
            flash('error', 'No active kiosk device registered.');
        }
        redirect(url('pages/kiosk/index.php'));
    }

    $now = Documents::now();

    if ($action === 'clock_out') {
        Database::collection('attendance')->updateOne(
            ['member_id' => $memberId, 'service_id' => $serviceId],
            ['$set' => [
                'clock_out_at' => $now,
                'updated_at' => $now,
            ]]
        );
        AuthService::audit('kiosk.clock_out', 'attendance', null, compact('memberId', 'serviceId'));
        flash('success', 'Clock-out recorded (online).');
    } else {
        $service = Documents::one(
            Database::collection('services')->findOne(['_id' => Documents::id($serviceId)])
        );
        $status = 'present';
        if ($service && !empty($service['starts_at'])) {
            $lateAt = strtotime((string) $service['starts_at']) + ((int) ($service['late_after_minutes'] ?? 15) * 60);
            if (time() > $lateAt) {
                $status = 'late';
            }
        }

        $existing = Database::collection('attendance')->findOne([
            'member_id' => $memberId,
            'service_id' => $serviceId,
        ]);

        if ($existing) {
            Database::collection('attendance')->updateOne(
                ['_id' => $existing['_id']],
                ['$set' => [
                    'clock_in_at' => $existing['clock_in_at'] ?? $now,
                    'status' => $status,
                    'updated_at' => $now,
                ]]
            );
            $attId = (string) $existing['_id'];
        } else {
            $result = Database::collection('attendance')->insertOne([
                'member_id' => $memberId,
                'service_id' => $serviceId,
                'clock_in_at' => $now,
                'clock_out_at' => null,
                'status' => $status,
                'verify_method' => 'manual',
                'source_mode' => 'online',
                'device_id' => $device['id'] ?? null,
                'client_event_id' => $clientEventId,
                'synced_from_offline' => false,
                'notes' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $attId = (string) $result->getInsertedId();
        }

        AuthService::audit('kiosk.clock_in', 'attendance', $attId, [
            'member_id' => $memberId,
            'service_id' => $serviceId,
            'status' => $status,
        ]);
        flash('success', 'Clock-in recorded (online) as ' . $status . '.');
    }

    redirect(url('pages/kiosk/index.php'));
}

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="row g-3">
  <div class="col-lg-7">
    <div class="kiosk-stage mb-3">
      <div>
        <span id="kioskModeBadge" class="mode-badge mode-online mb-3">Online</span>
        <h2>Ready for biometric capture</h2>
        <p class="empty-hint mb-0">
          Phase 0–1: use manual select below.<br>
          Phase 2 will add webcam face capture + fingerprint scan here.
        </p>
      </div>
    </div>

    <div class="panel-card">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem;">Manual / test clock</h3>
      <?php if (!$services || !$members): ?>
        <p class="empty-hint mb-0">
          Add at least one <a href="<?= e(url('pages/services/index.php')) ?>">service</a>
          and one <a href="<?= e(url('pages/members/create.php')) ?>">member</a> first.
        </p>
      <?php else: ?>
        <form method="post" id="kioskForm">
          <?= csrf_field() ?>
          <input type="hidden" name="client_mode" id="client_mode" value="online">
          <input type="hidden" name="client_event_id" id="client_event_id" value="">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">Service</label>
              <select class="form-select" name="service_id" required>
                <?php foreach ($services as $s): ?>
                  <option value="<?= e((string) $s['id']) ?>"><?= e($s['title'] . ' · ' . date('g:i A', strtotime((string) $s['starts_at']))) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Member</label>
              <select class="form-select" name="member_id" required>
                <?php foreach ($members as $m): ?>
                  <option value="<?= e((string) $m['id']) ?>">
                    <?= e($m['last_name'] . ', ' . $m['first_name'] . ' (' . $m['member_code'] . ')') ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
          </div>
          <div class="form-check mt-3">
            <input class="form-check-input" type="checkbox" name="force_offline" id="force_offline" value="1">
            <label class="form-check-label" for="force_offline">Simulate offline (queue instead of live write)</label>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-accent" type="submit" name="action" value="clock_in">Clock in</button>
            <button class="btn btn-outline-secondary" type="submit" name="action" value="clock_out">Clock out</button>
            <button class="btn btn-outline-primary" type="button" id="btnFlushQueue">Flush local queue</button>
          </div>
        </form>
      <?php endif; ?>
    </div>
  </div>

  <div class="col-lg-5">
    <div class="panel-card mb-3">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem;">Device</h3>
      <?php if (!$device): ?>
        <p class="empty-hint mb-0">No device seeded. Run the installer.</p>
      <?php else: ?>
        <p class="mb-1"><strong><?= e($device['name']) ?></strong></p>
        <p class="small text-muted mb-2"><?= e($device['device_code']) ?> · <?= e($device['location'] ?: '—') ?></p>
        <span class="mode-badge mode-<?= e((string) $device['mode']) ?>"><?= e(ucfirst((string) $device['mode'])) ?></span>
      <?php endif; ?>
    </div>
    <div class="panel-card">
      <h3 style="font-family: var(--font-display); font-size: 1.1rem;">Hybrid mode</h3>
      <ul class="small mb-0">
        <li><strong>Online</strong> — attendance writes to MongoDB now.</li>
        <li><strong>Offline</strong> — event goes to SyncQueue / IndexedDB.</li>
        <li><strong>Reconnect</strong> — browser flushes queue to <code>/api/sync/push</code>.</li>
      </ul>
    </div>
  </div>
</div>

<script>
  window.APC_DEVICE = {
    deviceCode: <?= json_encode($device['device_code'] ?? 'KIOSK-MAIN-01') ?>,
    deviceToken: <?= json_encode('dev-token-change-me') ?>,
    pushUrl: <?= json_encode(url('api/sync/push.php')) ?>,
    pullUrl: <?= json_encode(url('api/sync/pull.php')) ?>
  };

  (function () {
    const modeInput = document.getElementById('client_mode');
    const eventInput = document.getElementById('client_event_id');
    const badge = document.getElementById('kioskModeBadge');
    const form = document.getElementById('kioskForm');

    function refreshMode() {
      const online = navigator.onLine;
      if (modeInput) modeInput.value = online ? 'online' : 'offline';
      if (badge) {
        badge.className = 'mode-badge mode-' + (online ? 'online' : 'offline');
        badge.textContent = online ? 'Online' : 'Offline';
      }
    }

    window.addEventListener('apc:connectivity', refreshMode);
    refreshMode();

    if (form) {
      form.addEventListener('submit', function () {
        if (eventInput && window.APCSync) {
          eventInput.value = window.APCSync.uuid();
        }
      });
    }

    const flushBtn = document.getElementById('btnFlushQueue');
    if (flushBtn && window.APCSync) {
      flushBtn.addEventListener('click', async function () {
        try {
          const result = await window.APCSync.flushQueue(
            window.APC_DEVICE.pushUrl,
            window.APC_DEVICE.deviceCode,
            window.APC_DEVICE.deviceToken
          );
          alert(result.ok ? ('Synced ' + (result.accepted || 0) + ' event(s)') : (result.error || 'Sync failed'));
        } catch (e) {
          alert('Flush failed: ' + e.message);
        }
      });
    }
  })();
</script>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
