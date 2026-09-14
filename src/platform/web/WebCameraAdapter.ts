import { IPlatformCamera, BarcodeScanResult } from '../contracts/camera.interface';

/**
 * Web implementation of IPlatformCamera.
 * Provides media device capability checks for QR verification on web.
 */
export class WebCameraAdapter implements IPlatformCamera {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async scanBarcode(): Promise<BarcodeScanResult | null> {
    // In web environment, QR scanning uses file upload or video stream overlay.
    // Placeholder returning null for programmatic interface readiness.
    return null;
  }
}

export const webCamera = new WebCameraAdapter();
