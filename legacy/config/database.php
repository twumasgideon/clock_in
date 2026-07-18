<?php

declare(strict_types=1);

/**
 * MongoDB connection settings.
 */
return [
    'uri' => getenv('MONGODB_URI') ?: 'mongodb://127.0.0.1:27017',
    'database' => getenv('MONGODB_DATABASE') ?: 'apc_attendance',
    // Optional auth (leave empty for local unauthenticated)
    'username' => getenv('MONGODB_USERNAME') ?: '',
    'password' => getenv('MONGODB_PASSWORD') ?: '',
];
