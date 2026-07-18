<?php

declare(strict_types=1);

namespace App\Auth;

use App\Database;
use App\Support\Documents;

final class AuthService
{
    public static function attempt(string $email, string $password): bool
    {
        $user = Documents::one(
            Database::collection('users')->findOne(['email' => strtolower(trim($email))])
        );

        if (!$user || empty($user['is_active'])) {
            return false;
        }

        if (!password_verify($password, (string) ($user['password_hash'] ?? ''))) {
            return false;
        }

        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            Database::collection('users')->updateOne(
                ['_id' => Documents::id($user['id'])],
                ['$set' => ['password_hash' => password_hash($password, PASSWORD_DEFAULT), 'updated_at' => Documents::now()]]
            );
        }

        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (string) $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
        ];

        Database::collection('users')->updateOne(
            ['_id' => Documents::id($user['id'])],
            ['$set' => ['last_login_at' => Documents::now(), 'updated_at' => Documents::now()]]
        );

        self::audit('login', 'users', (string) $user['id']);

        return true;
    }

    public static function user(): ?array
    {
        return $_SESSION['user'] ?? null;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function id(): ?string
    {
        $user = self::user();
        return $user ? (string) $user['id'] : null;
    }

    public static function role(): ?string
    {
        return self::user()['role'] ?? null;
    }

    public static function hasRole(string ...$roles): bool
    {
        $role = self::role();
        return $role !== null && in_array($role, $roles, true);
    }

    public static function logout(): void
    {
        if (self::check()) {
            self::audit('logout', 'users', self::id());
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], (bool) $params['secure'], (bool) $params['httponly']);
        }
        session_destroy();
    }

    public static function audit(string $action, ?string $entityType = null, ?string $entityId = null, ?array $meta = null): void
    {
        try {
            Database::collection('audit_logs')->insertOne([
                'actor_user_id' => self::id(),
                'actor_device_id' => null,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'meta' => $meta,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => Documents::now(),
            ]);
        } catch (\Throwable) {
            // Never break the request for audit failures during early bootstrap.
        }
    }
}
