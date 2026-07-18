<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;
use App\Database;
use App\Support\Documents;

Middleware::requireRole('admin');

$pageTitle = 'Users';
$activeNav = 'users';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_post_csrf();
    $name = trim((string) ($_POST['full_name'] ?? ''));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $role = (string) ($_POST['role'] ?? 'officer');
    $password = (string) ($_POST['password'] ?? '');

    if ($name === '' || $email === '' || strlen($password) < 8) {
        $errors[] = 'Name, email, and password (8+ chars) are required.';
    } elseif (!in_array($role, ['admin', 'officer', 'pastor', 'member'], true)) {
        $errors[] = 'Invalid role.';
    } else {
        $now = Documents::now();
        try {
            $result = Database::collection('users')->insertOne([
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'full_name' => $name,
                'role' => $role,
                'is_active' => true,
                'member_id' => null,
                'last_login_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            AuthService::audit('user.create', 'users', (string) $result->getInsertedId());
            flash('success', 'User created.');
            redirect(url('pages/users/index.php'));
        } catch (Throwable $e) {
            $errors[] = 'Could not create user (email may exist).';
        }
    }
}

$users = Documents::many(
    Database::collection('users')->find(
        [],
        [
            'sort' => ['created_at' => -1],
            'projection' => [
                'email' => 1,
                'full_name' => 1,
                'role' => 1,
                'is_active' => 1,
                'last_login_at' => 1,
                'created_at' => 1,
            ],
        ]
    )
);

require dirname(__DIR__, 3) . '/includes/layout/header.php';
?>

<div class="row g-3">
  <div class="col-lg-4">
    <div class="panel-card">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Add user</h2>
      <?php foreach ($errors as $err): ?>
        <div class="alert alert-danger py-2"><?= e($err) ?></div>
      <?php endforeach; ?>
      <form method="post">
        <?= csrf_field() ?>
        <div class="mb-2">
          <label class="form-label">Full name</label>
          <input class="form-control" name="full_name" required>
        </div>
        <div class="mb-2">
          <label class="form-label">Email</label>
          <input class="form-control" type="email" name="email" required>
        </div>
        <div class="mb-2">
          <label class="form-label">Role</label>
          <select class="form-select" name="role">
            <?php foreach (app_config('roles', []) as $key => $label): ?>
              <option value="<?= e((string) $key) ?>"><?= e((string) $label) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input class="form-control" type="password" name="password" required minlength="8">
        </div>
        <button class="btn btn-accent w-100" type="submit">Create user</button>
      </form>
    </div>
  </div>
  <div class="col-lg-8">
    <div class="panel-card">
      <h2 style="font-family: var(--font-display); font-size: 1.15rem;">Accounts</h2>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($users as $u): ?>
              <tr>
                <td><?= e($u['full_name']) ?></td>
                <td><?= e($u['email']) ?></td>
                <td><?= e(role_label($u['role'])) ?></td>
                <td><?= !empty($u['is_active']) ? 'Yes' : 'No' ?></td>
                <td><?= !empty($u['last_login_at']) ? e(date('M j, g:i A', strtotime((string) $u['last_login_at']))) : '—' ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<?php require dirname(__DIR__, 3) . '/includes/layout/footer.php'; ?>
