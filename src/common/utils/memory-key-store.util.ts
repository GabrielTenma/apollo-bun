/**
 * Memory Key Store Utility
 *
 * Provides an in-memory key-value storage mechanism with TTL (Time To Live) support.
 * Useful for caching, temporary data storage, and session management.
 * Thread-safe for Node.js single-threaded environment with async operation safety.
 *
 * @example
 * import { MemoryKeyStore } from './memory-key-store.util';
 *
 * const store = new MemoryKeyStore();
 * store.set('key', 'value', 60000); // 60 seconds TTL
 * const value = store.get('key');
 * store.delete('key');
 * store.clear();
 */

export interface MemoryEntry<T = any> {
  value: T;
  expiresAt?: number;
}

export class MemoryKeyStore {
  private store: Map<string, MemoryEntry> = new Map();
  private pendingPromises: Map<string, Promise<any>> = new Map();

  /**
   * Set a value in the store with optional TTL
   * @param key - The key to store the value under
   * @param value - The value to store
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const entry: MemoryEntry<T> = {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };
    this.store.set(key, entry);
  }

  /**
   * Get a value from the store
   * @param key - The key to retrieve
   * @returns The stored value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Delete a key from the store
   * @param key - The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Check if a key exists and is not expired
   * @param key - The key to check
   * @returns true if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from the store
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of non-expired entries in the store
   * @returns The number of valid entries
   */
  size(): number {
    let count = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        count++;
      } else {
        // Clean up expired entry
        this.store.delete(key);
      }
    }

    return count;
  }

  /**
   * Get all non-expired keys in the store
   * @returns Array of keys
   */
  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        validKeys.push(key);
      } else {
        // Clean up expired entry
        this.store.delete(key);
      }
    }

    return validKeys;
  }

  /**
   * Get all non-expired values in the store
   * @returns Array of values
   */
  values(): any[] {
    const now = Date.now();
    const validValues: any[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        validValues.push(entry.value);
      } else {
        // Clean up expired entry
        this.store.delete(key);
      }
    }

    return validValues;
  }

  /**
   * Clean up all expired entries
   * @returns The number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get or set a value if it doesn't exist (lazy initialization)
   * This method is safe from race conditions for async factory functions.
   * @param key - The key to get or set
   * @param factory - Factory function to create the value if it doesn't exist (can be async)
   * @param ttl - Time to live in milliseconds (optional)
   * @returns Promise resolving to the existing or newly created value
   */
  async getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Check if value already exists
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    // Check if there's already a pending promise for this key (prevents race condition)
    const pending = this.pendingPromises.get(key);
    if (pending) {
      return pending;
    }

    // Create new promise and store it to prevent race conditions
    const promise = (async () => {
      try {
        const value = await factory();
        this.set(key, value, ttl);
        return value;
      } finally {
        // Remove from pending promises when done
        this.pendingPromises.delete(key);
      }
    })();

    this.pendingPromises.set(key, promise);
    return promise;
  }

  /**
   * Synchronous version of getOrSet for sync factories only
   * Use this when the factory is synchronous to avoid unnecessary async overhead
   * @param key - The key to get or set
   * @param factory - Synchronous factory function
   * @param ttl - Time to live in milliseconds (optional)
   * @returns The existing or newly created value
   */
  getOrSetSync<T>(key: string, factory: () => T, ttl?: number): T {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    // Check if there's a pending async operation
    if (this.pendingPromises.has(key)) {
      throw new Error(
        'Async factory already pending for this key. Use getOrSet() instead.',
      );
    }

    const value = factory();
    this.set(key, value, ttl);
    return value;
  }
}

// Export a default singleton instance for convenience
export const memoryKeyStore = new MemoryKeyStore();
