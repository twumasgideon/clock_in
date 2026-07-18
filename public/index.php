<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;
use App\Sync\SyncService;

Middleware::requireAuth();

$pageTitle = 'Dashboard';
$activeNav = 'dashboard';

$todayStart = Documents::date((new DateTimeImmutable('today'))->format('Y-m-d 00:00:00'));
$todayEnd = Documents::date((new DateTimeImmutable('tomorrow'))->format('Y-m-d 00:00:00'));
$dayAgo = Documents::date((new DateTimeImmutable('-1 day'))->format('c'));

$stats = [
    'members' => (int) Database::collection('members')->countDocuments(['membership_status' => 'active']),
    'today' => (int) Database::collection('attendance')->countDocuments([
        'clock_in_at' => ['$gte' => $todayStart, '$lt' => $todayEnd],
    ]),
    'services' => (int) Database::collection('services')->countDocuments([
        'is_active' => true,
        'starts_at' => ['$gte' => $dayAgo],
    ]),
    'pending_sync' => SyncService::pendingCount(),
];

$deviceStats = SyncService::deviceStats();

$recentRaw = Documents::many(
    Database::collection('attendance')->find(
        [],
        ['sort' => ['clock_in_at' => -1], 'limit' => 8]
    )
);

$memberMap = [];
$serviceMap = [];
$memberIds = array_values(array_unique(array_filter(array_column($recentRaw, 'member_id'))));
$serviceIds = array_values(array_unique(array_filter(array_column($recentRaw, 'service_id'))));

if ($memberIds) {
    foreach (Documents::many(Database::collection('members')->find([
        '_id' => ['$in' => array_values(array_filter(array_map([Documents::class, 'id'], $memberIds)))],
    ])) as $m) {
        $memberMap[$m['id']] = $m;
    }
}
if ($serviceIds) {
    foreach (Documents::many(Database::collection('services')->find([
        '_id' => ['$in' => array_values(array_filter(array_map([Documents::class, 'id'], $serviceIds)))],
    ])) as $s) {
        $serviceMap[$s['id']] = $s;
    }
}

$recent = [];
foreach ($recentRaw as $row) {
    $m = $memberMap[$row['member_id'] ?? ''] ?? null;
    $s = $serviceMap[$row['service_id'] ?? ''] ?? null;
    $recent[] = array_merge($row, [
        'first_name' => $m['first_name'] ?? '—',
        'last_name' => $m['last_name'] ?? '',
        'member_code' => $m['member_code'] ?? '',
        'service_title' => $s['title'] ?? '—',
    ]);
}

$upcoming = Documents::many(
    Database::collection('services')->find(
        [
            'is_active' => true,
            'starts_at' => ['$gte' => Documents::date((new DateTimeImmutable('-2 hours'))->format('c'))],
        ],
        ['sort' => ['starts_at' => 1], 'limit' => 5]
    )
);

require dirname(__DIR__) . '/includes/layout/header.php';
?>

<div class="stat-grid mb-4">
  <div class="stat-card">
    <div class="label">Active members</div>
    <p class="value"><?= (int) $stats['members'] ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Clock-ins today</div>
    <p class="value"><?= (int) $stats['today'] ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Active services</div>
    <p class="value"><?= (int) $stats['services'] ?></p>
  </div>
  <div class="stat-card">
    <div class="label">Pending sync</div>
    <p class="value"><?= (int) $stats['pending_sync'] ?></p>
  </div>
</div>

<div class="row g-3">
  <div class="col-lg-8">
    <div class="panel-card">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h2 class="mb-0">Recent attendance</h2>
        <a class="btn btn-sm btn-outline-secondary" href="<?= e(url('pages/attendance/index.php')) ?>">View all</a>
      </div>
      <?php if (!$recent): ?>
        <p class="empty-hint mb-0">No attendance records yet. Open the kiosk to clock members in.</p>
      <?php else: ?>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Member</th>
                <th>Service</th>
                <th>Time</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($recent as $row): ?>
                <tr>
                  <td>
                    <strong><?= e($row['first_name'] . ' ' . $row['last_name']) ?></strong>
                    <div class="small text-muted"><?= e($row['member_code']) ?></div>
                  </td>
                  <td><?= e($row['service_title']) ?></td>
                  <td><?= e($row['clock_in_at'] ? date('M j, g:i A', strtotime((string) $row['clock_in_at'])) : '—') ?></td>
                  <td>
                    <span class="mode-badge mode-<?= e((string) $row['source_mode']) ?>">
                      <?= e(ucfirst((string) $row['source_mode'])) ?>
                    </span>
                    <?php if (!empty($row['synced_from_offline'])): ?>
                      <span class="small text-muted d-block">synced</span>
                    <?php endif; ?>
                  </td>
                  <td><?= e(ucfirst((string) $row['status'])) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </div>
  </div>

  <div class="col-lg-4">
    <div class="panel-card mb-3">
      <h3>Connectivity</h3>
      <p class="mb-2">
        Kiosks online:
        <strong><?= (int) ($deviceStats['online_count'] ?? 0) ?></strong>
        /
        <?= (int) ($deviceStats['total'] ?? 0) ?>
      </p>
      <p class="mb-2">
        Offline:
        <strong><?= (int) ($deviceStats['offline_count'] ?? 0) ?></strong>
        · Syncing:
        <strong><?= (int) ($deviceStats['syncing_count'] ?? 0) ?></strong>
      </p>
      <p class="small text-muted mb-0">
        Last sync:
        <?= !empty($deviceStats['last_sync_at']) ? e(date('M j, g:i A', strtotime((string) $deviceStats['last_sync_at']))) : 'Never' ?>
      </p>
      <a class="btn btn-sm btn-accent mt-3" href="<?= e(url('pages/kiosk/index.php')) ?>">Open kiosk</a>
    </div>

    <div class="panel-card">
      <h3>Upcoming services</h3>
      <?php if (!$upcoming): ?>
        <p class="empty-hint mb-0">No upcoming services. Add one under Services.</p>
      <?php else: ?>
        <ul class="list-unstyled mb-0">
          <?php foreach ($upcoming as $svc): ?>
            <li class="mb-3">
              <strong><?= e($svc['title']) ?></strong>
              <div class="small text-muted">
                <?= e(date('D, M j · g:i A', strtotime((string) $svc['starts_at']))) ?>
                <?php if (!empty($svc['location'])): ?> · <?= e($svc['location']) ?><?php endif; ?>
              </div>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
  </div>
</div>

<?php require dirname(__DIR__) . '/includes/layout/footer.php'; ?>
