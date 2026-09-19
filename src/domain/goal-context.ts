import { FitnessGoal } from '@/types/user.types';

export interface GoalContextDetails {
  label: string;
  badgeStyle: {
    bg: string;
    color: string;
    border: string;
  };
  subtitle: string;
  nutritionHint: string;
  trainingFocus: string;
}

const GOAL_CONFIG: Record<FitnessGoal, GoalContextDetails> = {
  muscle_gain: {
    label: 'Muscle Gain',
    badgeStyle: {
      bg: 'rgba(99, 102, 241, 0.15)',
      color: 'var(--accent-indigo, #818cf8)',
      border: '1px solid rgba(99, 102, 241, 0.35)',
    },
    subtitle: 'Focus on progressive overload and meeting your protein & slight caloric surplus targets.',
    nutritionHint: 'Caloric surplus with high protein for muscle protein synthesis and tissue remodeling.',
    trainingFocus: 'Hypertrophy volume, time under tension, and mechanical tension.',
  },
  fat_loss: {
    label: 'Fat Loss',
    badgeStyle: {
      bg: 'rgba(239, 68, 68, 0.15)',
      color: 'var(--color-danger, #ef4444)',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    },
    subtitle: 'Maintain lifting intensity to preserve lean muscle while maintaining your moderate caloric deficit.',
    nutritionHint: 'Controlled caloric deficit; prioritize high protein to spare lean muscle mass.',
    trainingFocus: 'High-density strength work and preserving lean muscle mass.',
  },
  strength: {
    label: 'Strength Building',
    badgeStyle: {
      bg: 'rgba(234, 179, 8, 0.15)',
      color: 'var(--accent-gold, #eab308)',
      border: '1px solid rgba(234, 179, 8, 0.35)',
    },
    subtitle: 'Prioritize compound movements, maximal neuromuscular recruitment, and complete recovery.',
    nutritionHint: 'Sufficient energy and carbohydrates for maximal ATP-CP system recovery.',
    trainingFocus: 'Heavy compound loads (1-5 reps), longer rests, and pristine movement mechanics.',
  },
  endurance: {
    label: 'Endurance & Stamina',
    badgeStyle: {
      bg: 'rgba(56, 189, 248, 0.15)',
      color: 'var(--color-info, #38bdf8)',
      border: '1px solid rgba(56, 189, 248, 0.35)',
    },
    subtitle: 'Elevate work capacity, aerobic threshold, and muscular stamina across every circuit.',
    nutritionHint: 'Carbohydrate-dense fueling to sustain prolonged glycogen demands.',
    trainingFocus: 'Higher rep ranges, shorter rest periods, and cardiovascular resilience.',
  },
  maintenance: {
    label: 'Maintenance & Fitness',
    badgeStyle: {
      bg: 'rgba(16, 185, 129, 0.15)',
      color: 'var(--color-success, #10b981)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    },
    subtitle: 'Sustain peak conditioning, joint health, and balanced habitual consistency.',
    nutritionHint: 'Iso-caloric balance; consistent macronutrient distribution throughout the week.',
    trainingFocus: 'Balanced total-body functional strength and injury prevention.',
  },
};

const DEFAULT_GOAL_CONTEXT: GoalContextDetails = {
  label: 'General Fitness',
  badgeStyle: {
    bg: 'rgba(148, 163, 184, 0.15)',
    color: 'var(--text-secondary, #94a3b8)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
  },
  subtitle: 'Stay consistent, log your training, and hit your daily nutrition milestones.',
  nutritionHint: 'Balanced whole-food nutrition tailored to your daily energy expenditure.',
  trainingFocus: 'Consistent total-body training and progressive movement mastery.',
};

/**
 * Pure domain helper that maps a FitnessGoal to display label.
 */
export function getGoalLabel(goal?: FitnessGoal | null): string {
  if (!goal || !(goal in GOAL_CONFIG)) {
    return DEFAULT_GOAL_CONTEXT.label;
  }
  return GOAL_CONFIG[goal].label;
}

/**
 * Pure domain helper that maps a FitnessGoal to badge styles.
 */
export function getGoalBadgeStyle(goal?: FitnessGoal | null) {
  if (!goal || !(goal in GOAL_CONFIG)) {
    return DEFAULT_GOAL_CONTEXT.badgeStyle;
  }
  return GOAL_CONFIG[goal].badgeStyle;
}

/**
 * Pure domain helper that maps a FitnessGoal to a motivational subtitle.
 */
export function getGoalSubtitle(goal?: FitnessGoal | null): string {
  if (!goal || !(goal in GOAL_CONFIG)) {
    return DEFAULT_GOAL_CONTEXT.subtitle;
  }
  return GOAL_CONFIG[goal].subtitle;
}

/**
 * Pure domain helper that maps a FitnessGoal to nutrition advice.
 */
export function getGoalNutritionHint(goal?: FitnessGoal | null): string {
  if (!goal || !(goal in GOAL_CONFIG)) {
    return DEFAULT_GOAL_CONTEXT.nutritionHint;
  }
  return GOAL_CONFIG[goal].nutritionHint;
}

/**
 * Pure domain helper that returns all context details for a FitnessGoal.
 */
export function getGoalContextDetails(goal?: FitnessGoal | null): GoalContextDetails {
  if (!goal || !(goal in GOAL_CONFIG)) {
    return DEFAULT_GOAL_CONTEXT;
  }
  return GOAL_CONFIG[goal];
}
