/**
 * Geolocation & Haversine Distance Utilities for FitBoost Gym Verification.
 */

/**
 * Calculates great-circle distance between two geographic coordinates using Haversine formula.
 * @returns Distance in meters (rounded to nearest meter).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Validates whether user coordinates fall within the geofenced gym radius.
 */
export function isWithinGymRadius(
  userLat: number,
  userLng: number,
  gymLat: number,
  gymLng: number,
  radiusMeters: number = 200
): { isNearby: boolean; distanceMeters: number } {
  const distanceMeters = haversineDistanceMeters(userLat, userLng, gymLat, gymLng);
  return {
    isNearby: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}
