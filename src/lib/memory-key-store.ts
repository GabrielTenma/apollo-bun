/**
 * Memory Key Store Utility
 *
 * Provides an in-memory key-value storage mechanism with TTL (Time To Live) support.
 * Useful for caching, temporary data storage, and session management.
 * Thread-safe for Node.js single-threaded environment with async operation safety.
 *
 * @example
 * import { MemoryKeyStore } from '../lib/memory-key-store.ts';
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

  set<T>(key: string, value: T, ttl?: number): void {
    const entry: MemoryEntry<T> = {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };
    this.store.set(key, entry);
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) count++;
      else this.store.delete(key);
    }
    return count;
  }

  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) validKeys.push(key);
      else this.store.delete(key);
    }
    return validKeys;
  }

  values(): any[] {
    const now = Date.now();
    const validValues: any[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) validValues.push(entry.value);
      else this.store.delete(key);
    }
    return validValues;
  }

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

  async getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== undefined) return existing;
    const pending = this.pendingPromises.get(key);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const value = await factory();
        this.set(key, value, ttl);
        return value;
      } finally {
        this.pendingPromises.delete(key);
      }
    })();
    this.pendingPromises.set(key, promise);
    return promise;
  }

  getOrSetSync<T>(key: string, factory: () => T, ttl?: number): T {
    const existing = this.get<T>(key);
    if (existing !== undefined) return existing;
    if (this.pendingPromises.has(key)) {
      throw new Error('Async factory already pending for this key. Use getOrSet() instead.');
    }
    const value = factory();
    this.set(key, value, ttl);
    return value;
  }
}

export const memoryKeyStore = new MemoryKeyStore();
