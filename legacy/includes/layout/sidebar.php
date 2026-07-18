<?php

declare(strict_types=1);

use App\Auth\AuthService;

$user = AuthService::user();
$activeNav = $activeNav ?? '';

$nav = [
    ['key' => 'dashboard', 'label' => 'Dashboard', 'href' => url('index.php'), 'roles' => ['admin', 'officer', 'pastor', 'member']],
    ['key' => 'members', 'label' => 'Members', 'href' => url('pages/members/index.php'), 'roles' => ['admin', 'officer']],
    ['key' => 'services', 'label' => 'Services', 'href' => url('pages/services/index.php'), 'roles' => ['admin', 'officer', 'pastor']],
    ['key' => 'attendance', 'label' => 'Attendance', 'href' => url('pages/attendance/index.php'), 'roles' => ['admin', 'officer', 'pastor']],
    ['key' => 'kiosk', 'label' => 'Kiosk', 'href' => url('pages/kiosk/index.php'), 'roles' => ['admin', 'officer']],
    ['key' => 'devices', 'label' => 'Devices & Sync', 'href' => url('pages/devices/index.php'), 'roles' => ['admin']],
    ['key' => 'reports', 'label' => 'Reports', 'href' => url('pages/reports/index.php'), 'roles' => ['admin', 'officer', 'pastor']],
    ['key' => 'users', 'label' => 'Users', 'href' => url('pages/users/index.php'), 'roles' => ['admin']],
];
?>
<aside class="app-sidebar">
  <div class="brand-block">
    <p class="brand-mark">APC</p>
    <div>
      <p class="brand-name"><?= e((string) app_config('short_name')) ?></p>
      <p class="brand-sub">Face + Thumbprint</p>
    </div>
  </div>

  <nav class="side-nav">
    <?php foreach ($nav as $item): ?>
      <?php if ($user && in_array($user['role'], $item['roles'], true)): ?>
        <a class="side-link <?= $activeNav === $item['key'] ? 'is-active' : '' ?>" href="<?= e($item['href']) ?>">
          <?= e($item['label']) ?>
        </a>
      <?php endif; ?>
    <?php endforeach; ?>
  </nav>

  <div class="sidebar-foot">
    <p class="mode-legend">Modes</p>
    <p class="small mb-0">Online: live MongoDB write</p>
    <p class="small mb-0">Offline: SyncQueue → push</p>
  </div>
</aside>
