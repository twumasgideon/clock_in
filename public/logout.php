<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/helpers.php';
bootstrap_app();

use App\Auth\AuthService;

AuthService::logout();
flash('info', 'You have been signed out.');
redirect(url('login.php'));
