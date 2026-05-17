import { Injectable } from '@nestjs/common';

/**
 * Thread‑safe configuration service.
 *
 * The service eagerly copies all environment variables into a private, immutable
 * map during construction. Subsequent reads are performed against this map, which
 * guarantees that no mutation can occur after the service is instantiated –
 * providing safe concurrent access in an async Node.js environment.
 *
 * All helper methods operate on the cached map, falling back to optional default
 * values when a key is missing.
 *
 * NOTE: The constructor no longer requires `ConfigService` from `@nestjs/config`.
 * Under tsx / esbuild the `ConfigService` DI provider can return `undefined`
 * because esbuild strips the NestJS emitDecoratorMetadata helpers from CJS
 * bundles in node_modules. This class reads directly from `process.env` internally,
 * making the `configService` parameter unnecessary.
 */
@Injectable()
export class CommonConfigService {
  /**
   * Internal immutable map of configuration values.
   */
  private readonly configMap: Record<string, string>;

  constructor(_configService?: import('@nestjs/config').ConfigService) {
    // `_configService` is optional and unused; kept for backward compatibility.
    const map: Record<string, string> = {};
    for (const key of Object.keys(process.env)) {
      const value = process.env[key];
      if (value !== undefined && value !== null && value !== '') {
        map[key] = value.trim();
      }
    }
    this.configMap = map;
  }

  /** Retrieve a raw string value with an optional null‑safe fallback. */
  get(key: string, defaultValue?: string): string | undefined {
    const value = this.configMap[key];
    return value !== undefined ? value : defaultValue;
  }

  /** Retrieve a numeric value, parsed with base‑10. */
  getNumber(key: string, defaultValue?: number): number | undefined {
    const raw = this.get(key);
    if (raw === undefined) return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /** Retrieve a boolean value (case‑insensitive "true"). */
  getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const raw = this.get(key);
    if (raw === undefined) return defaultValue;
    return raw.toLowerCase() === 'true';
  }

  /**
   * Retrieve a JSON value and cast to T (object, array, map, etc.).
   * Falls back to `defaultValue` when the key is missing or the value is not valid JSON.
   */
  getObject<T>(key: string, defaultValue?: T): T | undefined {
    const raw = this.get(key);
    if (raw === undefined) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Retrieve an array of T by parsing the raw string value.
   *
   * Parsing strategy:
   *  1. Try `JSON.parse` – succeeds for `["a","b"]` or `[1,2]`.
   *  2. If that fails, split on `,` and trim each segment.
   *
   * Examples:
   *  - `"a,b,c"`          → `["a","b","c"]`
   *  - `'"a","b","c"'`    → `["a","b","c"]`  (JSON comma-parses)
   *  - `"a, b , c"`       → `["a","b","c"]`
   *  - `"[1,2,3]"`        → `[1,2,3]`
   *
   * @param key               Config key.
   * @param defaultValue      Returned when the key is absent or parsing fails.
   * @param separator         Delimiter for plain-string splitting (default `","`).
   * @param trimItems         Whether to trim whitespace from each item.
   */
  getArray<T = string>(
    key: string,
    defaultValue?: T[],
    separator = ',',
    trimItems = true,
  ): T[] | undefined {
    const raw = this.get(key);
    if (raw === undefined || raw === '') return defaultValue ?? [];

    /** Json array */
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed) as T[];
      } catch {
        // fall through to plain-string splitting
      }
    }

    /** Plain string split */
    const items = raw.split(separator);
    if (trimItems) {
      return items.map((s) => s.trim()) as T[];
    }
    return items as T[];
  }

  /**
   * Validate that a key exists and its value is one of the allowed options.
   * Returns the canonical (cased) option that was matched.
   *
   * @throws  Error if the key is missing, empty, or not in `allowed`.
   */
  getEnum(key: string, allowed: readonly string[]): string;
  /**
   * Variant with a fallback default returned silently when the key is missing.
   * Throws only if a value is present but not in `allowed`.
   */
  getEnum(
    key: string,
    allowed: readonly string[],
    defaultValue: string,
  ): string;
  getEnum(
    key: string,
    allowed: readonly string[],
    defaultValue?: string,
  ): string {
    const raw = this.get(key);
    if (raw === undefined || raw === '') {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(
        `Required config key "${key}" is not set. ` +
          `Allowed values: ${allowed.join(', ')}.`,
      );
    }
    if (!allowed.includes(raw)) {
      throw new Error(
        `Invalid value "${raw}" for config key "${key}". ` +
          `Allowed values: ${allowed.join(', ')}.`,
      );
    }
    return raw;
  }

  /**
   * Retrieve a required config value.
   * @throws  Error if the key is missing or its value is an empty / whitespace-only string.
   */
  require(key: string): string;
  /**
   * Variant with a fallback default returned when the key is missing.
   * Still throws when the key exists but is empty/whitespace-only.
   */
  require(key: string, defaultValue: string): string;
  require(key: string, defaultValue?: string): string {
    const raw = this.get(key);
    if (raw === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Required config key "${key}" is not set.`);
    }
    if (raw.trim() === '') {
      throw new Error(
        `Required config key "${key}" is set but is empty or whitespace-only.`,
      );
    }
    return raw;
  }

  /** Check existence of a key. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Return a shallow copy of the entire configuration map. */
  getAll(): Record<string, string> {
    return { ...this.configMap };
  }

  /** Return all configuration keys. */
  getKeys(): string[] {
    return Object.keys(this.configMap);
  }

  /** Return a map of entries that start with the given prefix. */
  getByPrefix(prefix: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.configMap)) {
      if (key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    return result;
  }
}
