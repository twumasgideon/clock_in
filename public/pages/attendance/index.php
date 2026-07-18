<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer', 'pastor');

$pageTitle = 'Attendance';
$activeNav = 'attendance';

$serviceId = (string) ($_GET['service_id'] ?? '');
$mode = (string) ($_GET['mode'] ?? '');

$services = Documents::many(
    Database::collection('services')->find([], [
        'sort' => ['starts_at' => -1],
        'limit' => 50,
        'projection' => ['title' => 1, 'starts_at' => 1],
    ])
);

$filter = [];
if ($serviceId !== '' && Documents::id($serviceId)) {
    $filter['service_id'] = $serviceId;
}
if (in_array($mode, ['online', 'offline'], true)) {
    $filter['source_mode'] = $mode;
}

$rowsRaw = Documents::many(
    Database::collection('attendance')->find($filter, [
        'sort' => ['clock_in_at' => -1],
        'limit' => 300,
    ])
);

$memberMap = [];
$serviceMap = [];
$memberIds = array_values(array_unique(array_filter(array_column($rowsRaw, 'member_id'))));
$serviceIds = array_values(array_unique(array_filter(array_column($rowsRaw, 'service_id'))));

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

$rows = [];
foreach ($rowsRaw as $r) {
    $m = $memberMap[$r['member_id'] ?? ''] ?? null;
    $s = $serviceMap[$r['service_id'] ?? ''] ?? null;
    $rows[] = array_merge($r, [
        'first_name' => $m['first_name'] ?? '—',
        'last_name' => $m['last_name'] ?? '',
        'member_code' => $m['member_code'] ?? '',
        'service_title' => $s['title'] ?? '—',
    ]);
}

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="panel-card">
  <form class="row g-2 align-items-end mb-3" method="get">
    <div class="col-md-5">
      <label class="form-label">Service</label>
      <select class="form-select" name="service_id">
        <option value="">All services</option>
        <?php foreach ($services as $s): ?>
          <option value="<?= e((string) $s['id']) ?>" <?= $serviceId === (string) $s['id'] ? 'selected' : '' ?>>
            <?= e($s['title'] . ' · ' . date('M j', strtotime((string) $s['starts_at']))) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="col-md-3">
      <label class="form-label">Mode</label>
      <select class="form-select" name="mode">
        <option value="">All</option>
        <option value="online" <?= $mode === 'online' ? 'selected' : '' ?>>Online</option>
        <option value="offline" <?= $mode === 'offline' ? 'selected' : '' ?>>Offline</option>
      </select>
    </div>
    <div class="col-md-2">
      <button class="btn btn-outline-secondary w-100" type="submit">Filter</button>
    </div>
  </form>

  <?php if (!$rows): ?>
    <p class="empty-hint mb-0">No attendance records match your filters.</p>
  <?php else: ?>
    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Member</th>
            <th>Service</th>
            <th>In</th>
            <th>Out</th>
            <th>Status</th>
            <th>Mode</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($rows as $r): ?>
            <tr>
              <td>
                <strong><?= e($r['first_name'] . ' ' . $r['last_name']) ?></strong>
                <div class="small text-muted"><?= e($r['member_code']) ?></div>
              </td>
              <td><?= e($r['service_title']) ?></td>
              <td><?= !empty($r['clock_in_at']) ? e(date('M j g:i A', strtotime((string) $r['clock_in_at']))) : '—' ?></td>
              <td><?= !empty($r['clock_out_at']) ? e(date('M j g:i A', strtotime((string) $r['clock_out_at']))) : '—' ?></td>
              <td><?= e(ucfirst((string) $r['status'])) ?></td>
              <td>
                <span class="mode-badge mode-<?= e((string) $r['source_mode']) ?>"><?= e(ucfirst((string) $r['source_mode'])) ?></span>
                <?php if (!empty($r['synced_from_offline'])): ?>
                  <span class="small text-muted">synced</span>
                <?php endif; ?>
              </td>
              <td class="small"><?= e(str_replace('_', ' ', (string) $r['verify_method'])) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
