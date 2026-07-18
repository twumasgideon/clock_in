<?php

declare(strict_types=1);

namespace App\Auth;

final class Middleware
{
    public static function requireAuth(): void
    {
        if (!AuthService::check()) {
            flash('error', 'Please sign in to continue.');
            redirect(url('login.php'));
        }
    }

    public static function requireRole(string ...$roles): void
    {
        self::requireAuth();
        if (!AuthService::hasRole(...$roles)) {
            flash('error', 'You do not have permission to access that page.');
            redirect(url('index.php'));
        }
    }

    public static function guestOnly(): void
    {
        if (AuthService::check()) {
            redirect(url('index.php'));
        }
    }
}
