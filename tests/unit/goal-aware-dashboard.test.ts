import { describe, it, expect } from 'vitest';
import {
  getGoalLabel,
  getGoalBadgeStyle,
  getGoalSubtitle,
  getGoalNutritionHint,
  getGoalContextDetails,
} from '@/domain/goal-context';
import { FitnessGoal } from '@/types/user.types';

describe('Goal Context Domain Helpers', () => {
  const allGoals: FitnessGoal[] = ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'maintenance'];

  it.each(allGoals)('provides correct label, badge style, and subtitle for %s', (goal) => {
    const label = getGoalLabel(goal);
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');

    const badgeStyle = getGoalBadgeStyle(goal);
    expect(badgeStyle).toHaveProperty('bg');
    expect(badgeStyle).toHaveProperty('color');
    expect(badgeStyle).toHaveProperty('border');

    const subtitle = getGoalSubtitle(goal);
    expect(subtitle).toBeTruthy();
    expect(typeof subtitle).toBe('string');

    const nutritionHint = getGoalNutritionHint(goal);
    expect(nutritionHint).toBeTruthy();

    const details = getGoalContextDetails(goal);
    expect(details.label).toBe(label);
    expect(details.badgeStyle).toEqual(badgeStyle);
    expect(details.subtitle).toBe(subtitle);
    expect(details.nutritionHint).toBe(nutritionHint);
    expect(details.trainingFocus).toBeTruthy();
  });

  it('safely handles null, undefined, or unknown goals with defaults', () => {
    expect(getGoalLabel(null)).toBe('General Fitness');
    expect(getGoalLabel(undefined)).toBe('General Fitness');
    expect(getGoalLabel('unknown_goal' as any)).toBe('General Fitness');

    const defaultStyle = getGoalBadgeStyle(undefined);
    expect(defaultStyle.color).toContain('text-secondary');

    const defaultSubtitle = getGoalSubtitle(null);
    expect(defaultSubtitle).toContain('Stay consistent');

    const defaultNutrition = getGoalNutritionHint(undefined);
    expect(defaultNutrition).toContain('Balanced whole-food nutrition');

    const details = getGoalContextDetails(null);
    expect(details.label).toBe('General Fitness');
  });

  it('provides goal-specific focus for muscle_gain vs fat_loss', () => {
    const muscleGain = getGoalContextDetails('muscle_gain');
    const fatLoss = getGoalContextDetails('fat_loss');

    expect(muscleGain.subtitle.toLowerCase()).toContain('surplus');
    expect(fatLoss.subtitle.toLowerCase()).toContain('deficit');

    expect(muscleGain.label).toBe('Muscle Gain');
    expect(fatLoss.label).toBe('Fat Loss');
  });
});
