/**
 * BRAND & PRODUCT CONFIGURATION
 *
 * NOTE: The product and brand name is temporary and replaceable.
 * Brand/domain/trademark availability has not been finalized.
 * All UI components, page titles, and marketing copy reference
 * these centralized constants rather than hardcoding any brand name.
 */

export const BRAND_CONFIG = {
  // Neutral temporary display name used across UI, page titles, and headers
  name: 'FITNESS',
  shortName: 'FITNESS',
  tagline: 'Consumer-First Personal Training & Nutrition Platform',
  defaultAthleteName: 'Athlete',
  
  // Storage key prefix (brand-agnostic)
  storagePrefix: 'fitness_app',
} as const;

export const PRODUCT_NAME = BRAND_CONFIG.name;
