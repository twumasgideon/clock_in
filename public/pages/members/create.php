<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin', 'officer');

$pageTitle = 'Register member';
$activeNav = 'members';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_post_csrf();

    $first = trim((string) ($_POST['first_name'] ?? ''));
    $last = trim((string) ($_POST['last_name'] ?? ''));
    $phone = trim((string) ($_POST['phone'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $gender = $_POST['gender'] ?? null;
    $code = trim((string) ($_POST['member_code'] ?? ''));

    if ($first === '' || $last === '') {
        $errors[] = 'First and last name are required.';
    }
    if ($code === '') {
        $code = 'APC-' . strtoupper(bin2hex(random_bytes(3)));
    }

    if (!$errors) {
        $now = Documents::now();
        try {
            $result = Database::collection('members')->insertOne([
                'member_code' => $code,
                'first_name' => $first,
                'last_name' => $last,
                'other_names' => trim((string) ($_POST['other_names'] ?? '')) ?: null,
                'gender' => in_array($gender, ['male', 'female', 'other'], true) ? $gender : null,
                'date_of_birth' => null,
                'phone' => $phone ?: null,
                'email' => $email ?: null,
                'address' => trim((string) ($_POST['address'] ?? '')) ?: null,
                'photo_path' => null,
                'membership_status' => 'active',
                'enrolled_face' => false,
                'enrolled_fingerprint' => false,
                'face_template_ref' => null,
                'fingerprint_template_ref' => null,
                'notes' => trim((string) ($_POST['notes'] ?? '')) ?: null,
                'created_at' => $now,
                'updated_at' => $now,
                'synced_at' => null,
            ]);
            $id = (string) $result->getInsertedId();
            AuthService::audit('member.create', 'members', $id, ['member_code' => $code]);
            flash('success', 'Member registered. Biometric enrollment comes in Phase 2.');
            redirect(url('pages/members/index.php'));
        } catch (Throwable $e) {
            $errors[] = 'Could not save member. Code may already exist.';
            if (app_config('debug')) {
                $errors[] = $e->getMessage();
            }
        }
    }
}

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="panel-card" style="max-width: 720px;">
  <h2 class="mb-3" style="font-family: var(--font-display); font-size: 1.2rem;">Member details</h2>
  <p class="text-muted small">Enrollment is online-only. Kiosks will pull this roster when connected.</p>

  <?php foreach ($errors as $err): ?>
    <div class="alert alert-danger py-2"><?= e($err) ?></div>
  <?php endforeach; ?>

  <form method="post">
    <?= csrf_field() ?>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Member code</label>
        <input class="form-control" name="member_code" placeholder="Auto if blank" value="<?= e($_POST['member_code'] ?? '') ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">First name *</label>
        <input class="form-control" name="first_name" required value="<?= e($_POST['first_name'] ?? '') ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">Last name *</label>
        <input class="form-control" name="last_name" required value="<?= e($_POST['last_name'] ?? '') ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">Other names</label>
        <input class="form-control" name="other_names" value="<?= e($_POST['other_names'] ?? '') ?>">
      </div>
      <div class="col-md-4">
        <label class="form-label">Gender</label>
        <select class="form-select" name="gender">
          <option value="">—</option>
          <?php foreach (['male', 'female', 'other'] as $g): ?>
            <option value="<?= $g ?>" <?= (($_POST['gender'] ?? '') === $g) ? 'selected' : '' ?>><?= ucfirst($g) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">Phone</label>
        <input class="form-control" name="phone" value="<?= e($_POST['phone'] ?? '') ?>">
      </div>
      <div class="col-md-6">
        <label class="form-label">Email</label>
        <input class="form-control" type="email" name="email" value="<?= e($_POST['email'] ?? '') ?>">
      </div>
      <div class="col-md-6">
        <label class="form-label">Address</label>
        <input class="form-control" name="address" value="<?= e($_POST['address'] ?? '') ?>">
      </div>
      <div class="col-12">
        <label class="form-label">Notes</label>
        <textarea class="form-control" name="notes" rows="2"><?= e($_POST['notes'] ?? '') ?></textarea>
      </div>
    </div>
    <div class="mt-4 d-flex gap-2">
      <button class="btn btn-accent" type="submit">Save member</button>
      <a class="btn btn-outline-secondary" href="<?= e(url('pages/members/index.php')) ?>">Cancel</a>
    </div>
  </form>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
