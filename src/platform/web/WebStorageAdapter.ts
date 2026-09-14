import { IPlatformStorage } from '../contracts/storage.interface';
import { logger } from '@/lib/logger';

/**
 * Web implementation of IPlatformStorage using window.localStorage / globalThis.localStorage
 * with an in-memory fallback for environments where storage is blocked or unavailable.
 */
export class WebStorageAdapter implements IPlatformStorage {
  private memoryFallback: Map<string, string> = new Map();

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  }

  getItem(key: string): string | null {
    const storage = this.getStorage();
    if (!storage) {
      return this.memoryFallback.get(key) ?? null;
    }
    try {
      return storage.getItem(key);
    } catch (err) {
      logger.warn(`WebStorageAdapter: Failed to read key "${key}" from localStorage`, { err });
      return this.memoryFallback.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    const storage = this.getStorage();
    if (!storage) {
      this.memoryFallback.set(key, value);
      return;
    }
    try {
      storage.setItem(key, value);
    } catch (err) {
      logger.warn(`WebStorageAdapter: Failed to write key "${key}" to localStorage`, { err });
      this.memoryFallback.set(key, value);
    }
  }

  removeItem(key: string): void {
    const storage = this.getStorage();
    if (!storage) {
      this.memoryFallback.delete(key);
      return;
    }
    try {
      storage.removeItem(key);
    } catch (err) {
      logger.warn(`WebStorageAdapter: Failed to delete key "${key}" from localStorage`, { err });
      this.memoryFallback.delete(key);
    }
  }

  clear(): void {
    const storage = this.getStorage();
    if (!storage) {
      this.memoryFallback.clear();
      return;
    }
    try {
      storage.clear();
    } catch (err) {
      logger.warn('WebStorageAdapter: Failed to clear localStorage', { err });
      this.memoryFallback.clear();
    }
  }
}

export const webStorage = new WebStorageAdapter();
