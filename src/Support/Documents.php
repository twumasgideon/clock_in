<?php

declare(strict_types=1);

namespace App\Support;

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Model\BSONArray;
use MongoDB\Model\BSONDocument;

final class Documents
{
    public static function id(mixed $value): ?ObjectId
    {
        if ($value instanceof ObjectId) {
            return $value;
        }
        if (is_string($value) && preg_match('/^[a-f\d]{24}$/i', $value)) {
            return new ObjectId($value);
        }
        return null;
    }

    public static function idString(mixed $docOrId): string
    {
        if ($docOrId instanceof ObjectId) {
            return (string) $docOrId;
        }
        if (is_array($docOrId) || $docOrId instanceof BSONDocument) {
            $arr = self::toArray($docOrId);
            return isset($arr['id']) ? (string) $arr['id'] : (isset($arr['_id']) ? (string) $arr['_id'] : '');
        }
        return (string) $docOrId;
    }

    public static function now(): UTCDateTime
    {
        return new UTCDateTime((int) (microtime(true) * 1000));
    }

    public static function date(string|\DateTimeInterface $value): UTCDateTime
    {
        if ($value instanceof \DateTimeInterface) {
            return new UTCDateTime($value->getTimestamp() * 1000);
        }
        $ts = strtotime($value);
        if ($ts === false) {
            return self::now();
        }
        return new UTCDateTime($ts * 1000);
    }

    public static function formatDate(mixed $value, string $format = 'Y-m-d H:i:s'): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof UTCDateTime) {
            return $value->toDateTime()->setTimezone(new \DateTimeZone(date_default_timezone_get()))->format($format);
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format($format);
        }
        $ts = strtotime((string) $value);
        return $ts === false ? null : date($format, $ts);
    }

    /**
     * @param mixed $value
     * @return array<string, mixed>|list<mixed>|scalar|null
     */
    public static function toArray(mixed $value): mixed
    {
        if ($value instanceof BSONDocument || $value instanceof BSONArray) {
            $value = $value->getArrayCopy();
        }

        if ($value instanceof ObjectId) {
            return (string) $value;
        }

        if ($value instanceof UTCDateTime) {
            return self::formatDate($value);
        }

        if (!is_array($value)) {
            return $value;
        }

        $out = [];
        foreach ($value as $k => $v) {
            $out[$k] = self::toArray($v);
        }

        if (isset($out['_id'])) {
            $out['id'] = (string) $out['_id'];
        }

        return $out;
    }

    /**
     * @param iterable<mixed> $cursor
     * @return list<array<string, mixed>>
     */
    public static function many(iterable $cursor): array
    {
        $rows = [];
        foreach ($cursor as $doc) {
            $rows[] = self::toArray($doc);
        }
        return $rows;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function one(mixed $doc): ?array
    {
        if ($doc === null) {
            return null;
        }
        $arr = self::toArray($doc);
        return is_array($arr) ? $arr : null;
    }
}
