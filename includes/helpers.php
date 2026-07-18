<?php

declare(strict_types=1);

/**
 * Shared helpers loaded by public entry points.
 */

use App\Auth\AuthService;
use App\Database;

function app_config(?string $key = null, mixed $default = null): mixed
{
    static $config;
    $config ??= require dirname(__DIR__) . '/config/app.php';
    if ($key === null) {
        return $config;
    }
    $parts = explode('.', $key);
    $value = $config;
    foreach ($parts as $part) {
        if (!is_array($value) || !array_key_exists($part, $value)) {
            return $default;
        }
        $value = $value[$part];
    }
    return $value;
}

function base_path(string $path = ''): string
{
    $root = dirname(__DIR__);
    return $path === '' ? $root : $root . DIRECTORY_SEPARATOR . ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path), DIRECTORY_SEPARATOR);
}

function url(string $path = ''): string
{
    $configured = rtrim((string) app_config('url', ''), '/');
    if ($configured !== '') {
        return $path === '' ? $configured : $configured . '/' . ltrim($path, '/');
    }

    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    $dir = str_replace('\\', '/', dirname($script));
    if (str_ends_with($dir, '/pages') || str_ends_with($dir, '/pages/members')
        || str_ends_with($dir, '/pages/services') || str_ends_with($dir, '/pages/attendance')
        || str_ends_with($dir, '/pages/users') || str_ends_with($dir, '/pages/devices')
        || str_ends_with($dir, '/pages/reports') || str_ends_with($dir, '/pages/kiosk')
        || str_ends_with($dir, '/api/sync')) {
        $dir = preg_replace('#/(pages(?:/[^/]+)?|api/sync)$#', '', $dir) ?: $dir;
    }
    $base = rtrim($dir, '/');
    return $path === '' ? ($base ?: '/') : $base . '/' . ltrim($path, '/');
}

function asset(string $path): string
{
    return url('assets/' . ltrim($path, '/'));
}

function redirect(string $to): never
{
    header('Location: ' . $to);
    exit;
}

function flash(string $key, ?string $message = null): ?string
{
    if ($message !== null) {
        $_SESSION['_flash'][$key] = $message;
        return null;
    }
    $value = $_SESSION['_flash'][$key] ?? null;
    unset($_SESSION['_flash'][$key]);
    return $value;
}

function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(?string $token): bool
{
    return is_string($token)
        && isset($_SESSION['_csrf'])
        && hash_equals($_SESSION['_csrf'], $token);
}

function require_post_csrf(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf($_POST['_csrf'] ?? null)) {
        http_response_code(419);
        flash('error', 'Invalid or expired form token. Please try again.');
        redirect($_SERVER['HTTP_REFERER'] ?? url('index.php'));
    }
}

function json_response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}

function current_user(): ?array
{
    return AuthService::user();
}

function role_label(string $role): string
{
    $roles = app_config('roles', []);
    return is_array($roles) ? ($roles[$role] ?? ucfirst($role)) : ucfirst($role);
}

/**
 * Autoload: Composer first, then fallback PSR-4 for App\.
 */
$composerAutoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_file($composerAutoload)) {
    require_once $composerAutoload;
} else {
    spl_autoload_register(static function (string $class): void {
        $prefix = 'App\\';
        if (!str_starts_with($class, $prefix)) {
            return;
        }
        $relative = substr($class, strlen($prefix));
        $file = dirname(__DIR__) . '/src/' . str_replace('\\', '/', $relative) . '.php';
        if (is_file($file)) {
            require $file;
        }
    });
}

function bootstrap_app(): void
{
    $config = app_config();
    date_default_timezone_set((string) ($config['timezone'] ?? 'UTC'));

    // Load .env if present
    $envFile = dirname(__DIR__) . '/.env';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if ($k !== '' && getenv($k) === false) {
                putenv("$k=$v");
                $_ENV[$k] = $v;
            }
        }
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name((string) ($config['session_name'] ?? 'apc_attendance_session'));
        session_start();
    }
}
