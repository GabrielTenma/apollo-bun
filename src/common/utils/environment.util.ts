/**
 * Universal environment-variable helper for bun runtime configuration.
 *
 * tsx / esbuild may drop NestJS's emitDecoratorMetadata helper calls from
 * pre-compiled CJS nest modules, which breaks `ConfigService` dependency
 * injection at construction time. This helper provides a side-effect-free
 * typed wrapper around `process.env` for all configuration lookups needed
 * during module construction.
 *
 * Usage
 * -----
 *   import { env } from '../utils/environment.util';
 *   const secret          = env.string('JWT_SECRET');           string | undefined
 *   const timeout         = env.number('TELEGRAM_TIMEOUT', 30000);// number
 *   const enabled         = env.boolean('ROUTINE_ENABLED', false); // boolean
 *   const allowedOrigins  = env.array('CORS_ORIGINS');           // string[]
 *   const jsonConfig      = env.object('SOME_JSON');             // unknown | undefined
 */

/**
 * Typed environment-variable accessor.
 * Reads directly from `process.env` — no NestJS DI involved.
 */
export const env = {
  /**
   * Return the raw string value of an env var.
   *
   * @param envKey        Environment variable name.
   * @param defaultValue  Fallback when the variable is not set or empty. Omit to return `undefined`.
   * @returns The env-var value, `defaultValue`, or `undefined`.
   */
  string(envKey: string, defaultValue?: string): string | undefined {
    const v = process.env[envKey];
    return v !== undefined && v !== '' ? v : defaultValue;
  },

  /**
   * Parse an env var as a base-10 integer.
   * @param envKey        Environment variable name.
   * @param defaultValue  Fallback when the variable is absent, empty, or non-numeric.
   * @returns The parsed number or `defaultValue`.
   */
  number(envKey: string, defaultValue?: number): number | undefined {
    const raw = this.string(envKey);
    if (raw === undefined || raw === '') return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  },

  /**
   * Parse an env var as a boolean.
   * Accepts `'true'` (case-insensitive) as `true`; everything else is `false`.
   * @param envKey        Environment variable name.
   * @param defaultValue  Fallback when the variable is absent or empty (default `false`).
   */
  boolean(envKey: string, defaultValue?: boolean): boolean {
    const raw = this.string(envKey);
    if (raw === undefined || raw === '') return defaultValue ?? false;
    return raw.toLowerCase() === 'true';
  },

  /**
   * Parse an env var as a JSON value and cast to `T`.
   * @param envKey        Environment variable name.
   * @param defaultValue  Fallback when the variable is absent or invalid JSON.
   */
  object<T = unknown>(envKey: string, defaultValue?: T): T | undefined {
    const raw = this.string(envKey);
    if (raw === undefined || raw === '') return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Parse an env var as a delimited string array.
   * @param envKey        Environment variable name.
   * @param separator     Delimiter (default `,`).
   * @param trimItems     Whether to trim whitespace around each element (default `true`).
   * @returns Array of trimmed string items, or an empty array.
   */
  array(envKey: string, separator = ',', trimItems = true): string[] {
    const raw = this.string(envKey);
    if (raw === undefined || raw === '') return [];
    const items = raw.split(separator);
    return trimItems ? items.map((s: string) => s.trim()) : items;
  },
};
