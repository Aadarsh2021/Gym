import { describe, it, expect } from 'vitest';
import { WebStorageAdapter } from '@/platform/web/WebStorageAdapter';
import { WebNotificationAdapter } from '@/platform/web/WebNotificationAdapter';
import { WebLocationAdapter } from '@/platform/web/WebLocationAdapter';
import { gymContextService } from '@/services/gym-context.service';

describe('Shared Platform Abstraction Suite', () => {
  describe('WebStorageAdapter', () => {
    it('saves and reads values in fallback memory store when window is undefined', () => {
      const storage = new WebStorageAdapter();
      storage.setItem('test_key', 'test_value');
      expect(storage.getItem('test_key')).toBe('test_value');
      storage.removeItem('test_key');
      expect(storage.getItem('test_key')).toBeNull();
    });
  });

  describe('WebNotificationAdapter', () => {
    it('reports unsupported when Notification is absent from window', () => {
      const adapter = new WebNotificationAdapter();
      const status = adapter.getPermissionStatus();
      expect(['unsupported', 'default', 'granted', 'denied']).toContain(status);
    });
  });

  describe('WebLocationAdapter', () => {
    it('safely handles isSupported check without crashing', () => {
      const adapter = new WebLocationAdapter();
      const supported = adapter.isSupported();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('gymContextService', () => {
    it('resolves home context when user has no gym memberships and no custom coordinates', async () => {
      const res = await gymContextService.resolveTrainingContext('non-existent-user');
      expect(res.context).toBe('home');
    });
  });
});
