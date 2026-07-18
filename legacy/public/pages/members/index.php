<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;
use MongoDB\BSON\Regex;

Middleware::requireRole('admin', 'officer');

$pageTitle = 'Members';
$activeNav = 'members';

$q = trim((string) ($_GET['q'] ?? ''));
$filter = [];
if ($q !== '') {
    $rx = new Regex(preg_quote($q, '/'), 'i');
    $filter['$or'] = [
        ['first_name' => $rx],
        ['last_name' => $rx],
        ['member_code' => $rx],
        ['phone' => $rx],
        ['email' => $rx],
    ];
}

$members = Documents::many(
    Database::collection('members')->find($filter, [
        'sort' => ['created_at' => -1],
        'limit' => 200,
    ])
);

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="panel-card">
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <form class="d-flex gap-2" method="get">
      <input class="form-control" type="search" name="q" placeholder="Search members…" value="<?= e($q) ?>">
      <button class="btn btn-outline-secondary" type="submit">Search</button>
    </form>
    <a class="btn btn-accent" href="<?= e(url('pages/members/create.php')) ?>">Register member</a>
  </div>

  <?php if (!$members): ?>
    <p class="empty-hint mb-0">No members yet. Register the first member to begin biometric enrollment.</p>
  <?php else: ?>
    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Biometrics</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($members as $m): ?>
            <tr>
              <td><?= e($m['member_code']) ?></td>
              <td><strong><?= e($m['first_name'] . ' ' . $m['last_name']) ?></strong></td>
              <td>
                <div><?= e($m['phone'] ?: '—') ?></div>
                <div class="small text-muted"><?= e($m['email'] ?: '') ?></div>
              </td>
              <td><?= e(ucfirst((string) $m['membership_status'])) ?></td>
              <td>
                <span class="badge text-bg-<?= !empty($m['enrolled_face']) ? 'success' : 'secondary' ?>">Face</span>
                <span class="badge text-bg-<?= !empty($m['enrolled_fingerprint']) ? 'success' : 'secondary' ?>">Print</span>
              </td>
              <td class="text-end">
                <a class="btn btn-sm btn-outline-secondary" href="<?= e(url('pages/members/edit.php?id=' . urlencode((string) $m['id']))) ?>">Edit</a>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
