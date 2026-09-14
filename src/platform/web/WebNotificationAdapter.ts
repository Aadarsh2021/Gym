import {
  IPlatformNotifications,
  NotificationPayload,
  PlatformNotificationPermission,
} from '../contracts/notifications.interface';
import { logger } from '@/lib/logger';

/**
 * Web implementation of IPlatformNotifications using the Browser Notification API and setTimeout.
 */
export class WebNotificationAdapter implements IPlatformNotifications {
  private activeTimers: Map<string | number, ReturnType<typeof setTimeout>> = new Map();

  getPermissionStatus(): PlatformNotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as PlatformNotificationPermission;
  }

  async requestPermission(): Promise<PlatformNotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission as PlatformNotificationPermission;
    } catch (err) {
      logger.error('WebNotificationAdapter: Error requesting notification permission', { err });
      return 'denied';
    }
  }

  async dispatchImmediate(payload: NotificationPayload): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission !== 'granted') {
      return false;
    }
    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon || '/vite.svg',
        badge: payload.badge || '/vite.svg',
        tag: payload.tag,
      });
      return true;
    } catch (err) {
      logger.error('WebNotificationAdapter: Failed to dispatch notification', { err });
      return false;
    }
  }

  async scheduleNotification(payload: NotificationPayload, delayMs = 0): Promise<string | number> {
    const handle = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(async () => {
      await this.dispatchImmediate(payload);
      this.activeTimers.delete(handle);
    }, delayMs);

    this.activeTimers.set(handle, timer);
    return handle;
  }

  async cancelNotification(handle: string | number): Promise<void> {
    const timer = this.activeTimers.get(handle);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(handle);
    }
  }

  clearAllScheduled(): void {
    this.activeTimers.forEach(timer => clearTimeout(timer));
    this.activeTimers.clear();
  }
}

export const webNotifications = new WebNotificationAdapter();
