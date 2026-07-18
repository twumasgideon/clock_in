<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer', 'pastor');

$pageTitle = 'Reports';
$activeNav = 'reports';

$from = (string) ($_GET['from'] ?? date('Y-m-01'));
$to = (string) ($_GET['to'] ?? date('Y-m-d'));

$fromDt = Documents::date($from . ' 00:00:00');
$toDt = Documents::date($to . ' 23:59:59');

$services = Documents::many(
    Database::collection('services')->find(
        ['starts_at' => ['$gte' => $fromDt, '$lte' => $toDt]],
        ['sort' => ['starts_at' => -1]]
    )
);

$byService = [];
foreach ($services as $svc) {
    $rows = Documents::many(
        Database::collection('attendance')->find(['service_id' => (string) $svc['id']])
    );
    $present = 0;
    $late = 0;
    $offline = 0;
    $synced = 0;
    foreach ($rows as $r) {
        if (($r['status'] ?? '') === 'present') {
            $present++;
        }
        if (($r['status'] ?? '') === 'late') {
            $late++;
        }
        if (($r['source_mode'] ?? '') === 'offline') {
            $offline++;
        }
        if (!empty($r['synced_from_offline'])) {
            $synced++;
        }
    }
    $byService[] = [
        'title' => $svc['title'],
        'starts_at' => $svc['starts_at'],
        'total' => count($rows),
        'present_count' => $present,
        'late_count' => $late,
        'offline_count' => $offline,
        'synced_count' => $synced,
    ];
}

$export = ($_GET['export'] ?? '') === 'csv';
if ($export) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="attendance-report-' . $from . '-to-' . $to . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Service', 'Starts', 'Total', 'Present', 'Late', 'Offline', 'Synced from offline']);
    foreach ($byService as $row) {
        fputcsv($out, [
            $row['title'],
            $row['starts_at'],
            $row['total'],
            $row['present_count'],
            $row['late_count'],
            $row['offline_count'],
            $row['synced_count'],
        ]);
    }
    fclose($out);
    exit;
}

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="panel-card">
  <form class="row g-2 align-items-end mb-3" method="get">
    <div class="col-md-3">
      <label class="form-label">From</label>
      <input class="form-control" type="date" name="from" value="<?= e($from) ?>">
    </div>
    <div class="col-md-3">
      <label class="form-label">To</label>
      <input class="form-control" type="date" name="to" value="<?= e($to) ?>">
    </div>
    <div class="col-md-3 d-flex gap-2">
      <button class="btn btn-outline-secondary" type="submit">Run</button>
      <a class="btn btn-accent" href="?from=<?= e(urlencode($from)) ?>&to=<?= e(urlencode($to)) ?>&export=csv">Export CSV</a>
    </div>
  </form>

  <?php if (!$byService): ?>
    <p class="empty-hint mb-0">No services in this date range.</p>
  <?php else: ?>
    <div class="table-responsive">
      <table class="table align-middle mb-0">
        <thead>
          <tr>
            <th>Service</th>
            <th>Date</th>
            <th>Total</th>
            <th>Present</th>
            <th>Late</th>
            <th>Offline</th>
            <th>Synced</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($byService as $row): ?>
            <tr>
              <td><strong><?= e($row['title']) ?></strong></td>
              <td><?= e(date('M j, Y', strtotime((string) $row['starts_at']))) ?></td>
              <td><?= (int) $row['total'] ?></td>
              <td><?= (int) $row['present_count'] ?></td>
              <td><?= (int) $row['late_count'] ?></td>
              <td><?= (int) $row['offline_count'] ?></td>
              <td><?= (int) $row['synced_count'] ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
