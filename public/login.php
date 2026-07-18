<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;
use App\Auth\Middleware;

Middleware::guestOnly();

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['_csrf'] ?? null)) {
        $error = 'Invalid form token.';
    } else {
        $email = (string) ($_POST['email'] ?? '');
        $password = (string) ($_POST['password'] ?? '');
        if ($email === '' || $password === '') {
            $error = 'Email and password are required.';
        } elseif (AuthService::attempt($email, $password)) {
            flash('success', 'Welcome back.');
            redirect(url('index.php'));
        } else {
            $error = 'Invalid credentials or inactive account.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · <?= e((string) app_config('short_name')) ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="<?= e(asset('css/app.css')) ?>" rel="stylesheet">
</head>
<body class="auth-page">
  <div class="auth-card">
    <p class="eyebrow text-muted mb-2"><?= e((string) app_config('church')) ?></p>
    <h1>Sign in</h1>
    <p class="text-muted mb-4">Member attendance · face + thumbprint · online &amp; offline</p>

    <?php if ($error): ?>
      <div class="alert alert-danger py-2"><?= e($error) ?></div>
    <?php endif; ?>

    <form method="post" autocomplete="on">
      <?= csrf_field() ?>
      <div class="mb-3">
        <label class="form-label" for="email">Email</label>
        <input class="form-control" type="email" name="email" id="email" required value="<?= e($_POST['email'] ?? 'admin@asokwa.church') ?>">
      </div>
      <div class="mb-4">
        <label class="form-label" for="password">Password</label>
        <input class="form-control" type="password" name="password" id="password" required>
      </div>
      <button class="btn btn-accent w-100" type="submit">Continue</button>
    </form>
    <p class="small text-muted mt-3 mb-0">Default after install: admin@asokwa.church / Admin@12345</p>
  </div>
</body>
</html>
