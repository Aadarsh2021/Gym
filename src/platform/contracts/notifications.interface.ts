/**
 * Platform Notifications Contract
 * Abstracts notification permissions and local/push dispatch across Web (Notification API)
 * and Mobile (APNs / FCM / Local Notifications).
 */
export type PlatformNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface IPlatformNotifications {
  getPermissionStatus(): PlatformNotificationPermission;
  requestPermission(): Promise<PlatformNotificationPermission>;
  scheduleNotification(payload: NotificationPayload, delayMs?: number): Promise<string | number>;
  cancelNotification(handle: string | number): Promise<void>;
  dispatchImmediate(payload: NotificationPayload): Promise<boolean>;
}
