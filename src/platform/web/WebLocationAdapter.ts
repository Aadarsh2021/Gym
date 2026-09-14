import { GeoCoordinates, IPlatformLocation } from '../contracts/location.interface';
import { logger } from '@/lib/logger';

/**
 * Web implementation of IPlatformLocation using navigator.geolocation.
 */
export class WebLocationAdapter implements IPlatformLocation {
  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<GeoCoordinates> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Geolocation is not supported in this browser environment'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
          });
        },
        error => {
          logger.warn('WebLocationAdapter: Geolocation error occurred', {
            code: error.code,
            message: error.message,
          });
          reject(error);
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 8000,
          maximumAge: options?.maximumAge ?? 30000,
        }
      );
    });
  }
}

export const webLocation = new WebLocationAdapter();
