<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer', 'pastor');

$pageTitle = 'Services';
$activeNav = 'services';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && AuthService::hasRole('admin', 'officer')) {
    require_post_csrf();
    $title = trim((string) ($_POST['title'] ?? ''));
    $starts = trim((string) ($_POST['starts_at'] ?? ''));
    $type = (string) ($_POST['service_type'] ?? 'sunday');

    if ($title === '' || $starts === '') {
        $errors[] = 'Title and start time are required.';
    } elseif (!in_array($type, ['sunday', 'midweek', 'special', 'event'], true)) {
        $errors[] = 'Invalid service type.';
    } else {
        $now = Documents::now();
        $result = Database::collection('services')->insertOne([
            'title' => $title,
            'service_type' => $type,
            'location' => trim((string) ($_POST['location'] ?? '')) ?: null,
            'starts_at' => Documents::date($starts),
            'ends_at' => ($_POST['ends_at'] ?? '') !== '' ? Documents::date((string) $_POST['ends_at']) : null,
            'late_after_minutes' => max(0, (int) ($_POST['late_after_minutes'] ?? 15)),
            'is_active' => true,
            'notes' => trim((string) ($_POST['notes'] ?? '')) ?: null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        AuthService::audit('service.create', 'services', (string) $result->getInsertedId());
        flash('success', 'Service scheduled.');
        redirect(url('pages/services/index.php'));
    }
}

$services = Documents::many(
    Database::collection('services')->find([], ['sort' => ['starts_at' => -1], 'limit' => 100])
);

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="row g-3">
  <?php if (AuthService::hasRole('admin', 'officer')): ?>
    <div class="col-lg-4">
      <div class="panel-card">
        <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Schedule service</h2>
        <?php foreach ($errors as $err): ?>
          <div class="alert alert-danger py-2"><?= e($err) ?></div>
        <?php endforeach; ?>
        <form method="post">
          <?= csrf_field() ?>
          <div class="mb-2">
            <label class="form-label">Title</label>
            <input class="form-control" name="title" required>
          </div>
          <div class="mb-2">
            <label class="form-label">Type</label>
            <select class="form-select" name="service_type">
              <option value="sunday">Sunday</option>
              <option value="midweek">Midweek</option>
              <option value="special">Special</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div class="mb-2">
            <label class="form-label">Location</label>
            <input class="form-control" name="location" placeholder="Main Auditorium">
          </div>
          <div class="mb-2">
            <label class="form-label">Starts at</label>
            <input class="form-control" type="datetime-local" name="starts_at" required>
          </div>
          <div class="mb-2">
            <label class="form-label">Ends at</label>
            <input class="form-control" type="datetime-local" name="ends_at">
          </div>
          <div class="mb-3">
            <label class="form-label">Late after (minutes)</label>
            <input class="form-control" type="number" name="late_after_minutes" value="15" min="0">
          </div>
          <button class="btn btn-accent w-100" type="submit">Save service</button>
        </form>
      </div>
    </div>
  <?php endif; ?>

  <div class="col-lg-<?= AuthService::hasRole('admin', 'officer') ? '8' : '12' ?>">
    <div class="panel-card">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Service calendar</h2>
      <?php if (!$services): ?>
        <p class="empty-hint mb-0">No services scheduled.</p>
      <?php else: ?>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>When</th>
                <th>Location</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($services as $s): ?>
                <tr>
                  <td><strong><?= e($s['title']) ?></strong></td>
                  <td><?= e(ucfirst((string) $s['service_type'])) ?></td>
                  <td><?= e(date('D, M j · g:i A', strtotime((string) $s['starts_at']))) ?></td>
                  <td><?= e($s['location'] ?: '—') ?></td>
                  <td><?= !empty($s['is_active']) ? 'Yes' : 'No' ?></td>
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
