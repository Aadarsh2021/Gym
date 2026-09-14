import { useAuth } from '@/hooks/useAuth';
import { PlanType } from '@/types/user.types';

export interface EntitlementState {
  planType: PlanType;
  isPremium: boolean;
  canAccessAlternatives: boolean;
  canAccessBudgetPlanning: boolean;
  canAccessMixedMealAnalyzer: boolean;
  canAccessMealReplacement: boolean;
  canAccessPremiumMealGenerator: boolean;
  canAccessDailyNutrientComparison: boolean;
  canAccessFullNutritionAnalysis: boolean;
  canAccessWeeklyMealPlanning: boolean;
}

/**
 * FitBoost Centralized Entitlement Hook
 * Single source of truth for feature access gating across the app.
 * Gracefully defaults to 'free' tier if session or profile is uninitialized.
 */
export function useEntitlement(): EntitlementState {
  const { session } = useAuth();
  const planType: PlanType = session.profile?.planType ?? 'free';
  const isPremium = planType === 'premium';

  return {
    planType,
    isPremium,
    canAccessAlternatives: isPremium,
    canAccessBudgetPlanning: isPremium,
    canAccessMixedMealAnalyzer: isPremium,
    canAccessMealReplacement: isPremium,
    canAccessPremiumMealGenerator: isPremium,
    canAccessDailyNutrientComparison: isPremium,
    canAccessFullNutritionAnalysis: isPremium,
    canAccessWeeklyMealPlanning: isPremium,
  };
}
