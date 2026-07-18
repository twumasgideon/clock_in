<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer');

$id = (string) ($_GET['id'] ?? '');
$oid = Documents::id($id);
$member = $oid ? Documents::one(Database::collection('members')->findOne(['_id' => $oid])) : null;

if (!$member) {
    flash('error', 'Member not found.');
    redirect(url('pages/members/index.php'));
}

$pageTitle = 'Edit member';
$activeNav = 'members';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_post_csrf();

    $first = trim((string) ($_POST['first_name'] ?? ''));
    $last = trim((string) ($_POST['last_name'] ?? ''));
    $status = (string) ($_POST['membership_status'] ?? 'active');

    if ($first === '' || $last === '') {
        $errors[] = 'First and last name are required.';
    }
    if (!in_array($status, ['active', 'inactive', 'transferred', 'deceased'], true)) {
        $errors[] = 'Invalid status.';
    }

    if (!$errors) {
        Database::collection('members')->updateOne(
            ['_id' => $oid],
            ['$set' => [
                'first_name' => $first,
                'last_name' => $last,
                'other_names' => trim((string) ($_POST['other_names'] ?? '')) ?: null,
                'gender' => in_array($_POST['gender'] ?? '', ['male', 'female', 'other'], true) ? $_POST['gender'] : null,
                'phone' => trim((string) ($_POST['phone'] ?? '')) ?: null,
                'email' => trim((string) ($_POST['email'] ?? '')) ?: null,
                'address' => trim((string) ($_POST['address'] ?? '')) ?: null,
                'membership_status' => $status,
                'notes' => trim((string) ($_POST['notes'] ?? '')) ?: null,
                'synced_at' => null,
                'updated_at' => Documents::now(),
            ]]
        );
        AuthService::audit('member.update', 'members', $id);
        flash('success', 'Member updated. Change will sync to kiosks on next pull.');
        redirect(url('pages/members/index.php'));
    }

    $member = array_merge($member, $_POST);
}

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="panel-card" style="max-width: 720px;">
  <p class="small text-muted">Code: <strong><?= e($member['member_code']) ?></strong></p>

  <?php foreach ($errors as $err): ?>
    <div class="alert alert-danger py-2"><?= e($err) ?></div>
  <?php endforeach; ?>

  <form method="post">
    <?= csrf_field() ?>
    <div class="row g-3">
      <div class="col-md-6">
        <label class="form-label">First name *</label>
        <input class="form-control" name="first_name" required value="<?= e($member['first_name']) ?>">
      </div>
      <div class="col-md-6">
        <label class="form-label">Last name *</label>
        <input class="form-control" name="last_name" required value="<?= e($member['last_name']) ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">Other names</label>
        <input class="form-control" name="other_names" value="<?= e($member['other_names'] ?? '') ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">Gender</label>
        <select class="form-select" name="gender">
          <option value="">—</option>
          <?php foreach (['male', 'female', 'other'] as $g): ?>
            <option value="<?= $g ?>" <?= (($member['gender'] ?? '') === $g) ? 'selected' : '' ?>><?= ucfirst($g) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Status</label>
        <select class="form-select" name="membership_status">
          <?php foreach (['active', 'inactive', 'transferred', 'deceased'] as $s): ?>
            <option value="<?= $s ?>" <?= ($member['membership_status'] === $s) ? 'selected' : '' ?>><?= ucfirst($s) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Phone</label>
        <input class="form-control" name="phone" value="<?= e($member['phone'] ?? '') ?>">
      </div>
      <div class="col-md-6">
        <label class="form-label">Email</label>
        <input class="form-control" type="email" name="email" value="<?= e($member['email'] ?? '') ?>">
      </div>
      <div class="col-12">
        <label class="form-label">Address</label>
        <input class="form-control" name="address" value="<?= e($member['address'] ?? '') ?>">
      </div>
      <div class="col-12">
        <label class="form-label">Notes</label>
        <textarea class="form-control" name="notes" rows="2"><?= e($member['notes'] ?? '') ?></textarea>
      </div>
    </div>
    <div class="mt-4 d-flex gap-2">
      <button class="btn btn-accent" type="submit">Save changes</button>
      <a class="btn btn-outline-secondary" href="<?= e(url('pages/members/index.php')) ?>">Back</a>
    </div>
  </form>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
