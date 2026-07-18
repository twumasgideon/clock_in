<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

bootstrap_app();

use App\Auth\AuthService;

/** @var string $pageTitle */
$pageTitle = $pageTitle ?? app_config('short_name');
/** @var string $activeNav */
$activeNav = $activeNav ?? '';
$user = AuthService::user();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($pageTitle) ?> · <?= e((string) app_config('short_name')) ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="<?= e(asset('css/app.css')) ?>" rel="stylesheet">
</head>
<body class="app-body" data-connectivity="unknown">
  <div class="app-shell">
    <?php if ($user): ?>
      <?php require __DIR__ . '/sidebar.php'; ?>
    <?php endif; ?>

    <div class="app-main">
      <?php if ($user): ?>
        <header class="app-topbar">
          <div>
            <p class="eyebrow mb-0"><?= e((string) app_config('church')) ?></p>
            <h1 class="topbar-title"><?= e($pageTitle) ?></h1>
          </div>
          <div class="topbar-actions">
            <span id="connectivityBadge" class="mode-badge mode-unknown" title="Network status">
              Checking…
            </span>
            <div class="user-chip">
              <span class="user-name"><?= e($user['full_name']) ?></span>
              <span class="user-role"><?= e(role_label($user['role'])) ?></span>
            </div>
            <a class="btn btn-sm btn-outline-light" href="<?= e(url('logout.php')) ?>">Sign out</a>
          </div>
        </header>
      <?php endif; ?>

      <main class="app-content">
        <?php if ($msg = flash('success')): ?>
          <div class="alert alert-success"><?= e($msg) ?></div>
        <?php endif; ?>
        <?php if ($msg = flash('error')): ?>
          <div class="alert alert-danger"><?= e($msg) ?></div>
        <?php endif; ?>
        <?php if ($msg = flash('info')): ?>
          <div class="alert alert-info"><?= e($msg) ?></div>
        <?php endif; ?>
