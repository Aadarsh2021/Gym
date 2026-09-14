/**
 * Platform Location Contract
 * Abstracts GPS / Geolocation services across Web (navigator.geolocation)
 * and Mobile (Native Geolocation / CoreLocation).
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
}

export interface IPlatformLocation {
  isSupported(): boolean;
  getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<GeoCoordinates>;
}
