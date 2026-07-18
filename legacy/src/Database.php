<?php

declare(strict_types=1);

namespace App;

use MongoDB\Client;
use MongoDB\Collection;
use MongoDB\Database as MongoDatabase;
use RuntimeException;

final class Database
{
    private static ?Client $client = null;
    private static ?MongoDatabase $db = null;

    public static function client(): Client
    {
        if (self::$client instanceof Client) {
            return self::$client;
        }

        $config = require dirname(__DIR__) . '/config/database.php';
        $uri = (string) $config['uri'];

        try {
            self::$client = new Client($uri);
        } catch (\Throwable $e) {
            throw new RuntimeException('MongoDB connection failed: ' . $e->getMessage(), 0, $e);
        }

        return self::$client;
    }

    public static function connection(): MongoDatabase
    {
        if (self::$db instanceof MongoDatabase) {
            return self::$db;
        }

        $config = require dirname(__DIR__) . '/config/database.php';
        self::$db = self::client()->selectDatabase((string) $config['database']);

        return self::$db;
    }

    public static function collection(string $name): Collection
    {
        return self::connection()->selectCollection($name);
    }
}
