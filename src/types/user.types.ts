export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'maintenance' | 'strength' | 'endurance';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type DietaryPreference = 'vegetarian' | 'vegan' | 'eggetarian' | 'non_vegetarian';
export type Gender = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';

// Explicitly separate Account Role from Subscription Plan
export type AccountRole = 'member' | 'gym_owner' | 'platform_admin';
export type PlanType = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type SubscriptionProvider = 'stripe' | 'apple_iap' | 'google_play' | 'manual';

export interface UserSubscription {
  id: string;
  userId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  currentPeriodEnd?: string | null;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  unitSystem: UnitSystem;
  timezone: string;
  avatarUrl?: string | null;
  accountRole?: AccountRole;
  planType?: PlanType;
}

export interface FitnessProfile {
  id: string;
  userId: string;
  age: number;
  heightCm: number;
  weightKg: number;
  gender: Gender;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  workoutDurationMinutes: number;
  equipment: string[];
  dietaryPreference: DietaryPreference;
  limitations: string[];
  gymLatitude?: number | null;
  gymLongitude?: number | null;
  gymRadiusMeters?: number | null;
}
