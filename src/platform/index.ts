import { IPlatformStorage } from './contracts/storage.interface';
import { IPlatformNotifications } from './contracts/notifications.interface';
import { IPlatformLocation } from './contracts/location.interface';
import { IPlatformCamera } from './contracts/camera.interface';

import { webStorage } from './web/WebStorageAdapter';
import { webNotifications } from './web/WebNotificationAdapter';
import { webLocation } from './web/WebLocationAdapter';
import { webCamera } from './web/WebCameraAdapter';

export interface PlatformContext {
  storage: IPlatformStorage;
  notifications: IPlatformNotifications;
  location: IPlatformLocation;
  camera: IPlatformCamera;
}

/**
 * Global Platform singleton.
 * Defaults to Web adapters, but allows programmatic injection for future Mobile clients
 * (e.g. React Native / Capacitor / testing mocks).
 */
class PlatformManager implements PlatformContext {
  storage: IPlatformStorage = webStorage;
  notifications: IPlatformNotifications = webNotifications;
  location: IPlatformLocation = webLocation;
  camera: IPlatformCamera = webCamera;

  configure(adapters: Partial<PlatformContext>): void {
    if (adapters.storage) this.storage = adapters.storage;
    if (adapters.notifications) this.notifications = adapters.notifications;
    if (adapters.location) this.location = adapters.location;
    if (adapters.camera) this.camera = adapters.camera;
  }
}

export const platform = new PlatformManager();

export * from './contracts/storage.interface';
export * from './contracts/notifications.interface';
export * from './contracts/location.interface';
export * from './contracts/camera.interface';
