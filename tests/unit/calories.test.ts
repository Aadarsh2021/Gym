import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateTDEE, calculateCalorieTarget, getActivityMultiplier } from '@/domain/calories';

describe('Calories Domain Engine', () => {
  it('should calculate accurate male BMR using Mifflin-St Jeor', () => {
    // 70kg, 175cm, 25yr male: (10*70) + (6.25*175) - (5*25) + 5 = 700 + 1093.75 - 125 + 5 = 1673.75 -> 1674
    const bmr = calculateBMR({ weightKg: 70, heightCm: 175, age: 25, gender: 'male' });
    expect(bmr).toBe(1674);
  });

  it('should calculate accurate female BMR using Mifflin-St Jeor (-161 offset)', () => {
    // 60kg, 165cm, 28yr female: (10*60) + (6.25*165) - (5*28) - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
    const bmr = calculateBMR({ weightKg: 60, heightCm: 165, age: 28, gender: 'female' });
    expect(bmr).toBe(1330);
  });

  it('should return 0 on invalid or non-positive biometrics', () => {
    expect(calculateBMR({ weightKg: -70, heightCm: 175, age: 25, gender: 'male' })).toBe(0);
    expect(calculateBMR({ weightKg: 70, heightCm: 0, age: 25, gender: 'male' })).toBe(0);
    expect(calculateBMR({ weightKg: 70, heightCm: 175, age: -5, gender: 'male' })).toBe(0);
  });

  it('should scale TDEE according to training days per week', () => {
    const bmr = 1600;
    expect(getActivityMultiplier(0)).toBe(1.2);
    expect(calculateTDEE(bmr, 0)).toBe(1920);

    expect(getActivityMultiplier(3)).toBe(1.55);
    expect(calculateTDEE(bmr, 3)).toBe(2480);

    expect(getActivityMultiplier(5)).toBe(1.725);
    expect(calculateTDEE(bmr, 5)).toBe(2760);
  });

  it('should adjust targets according to goal (deficit for fat loss, surplus for muscle gain)', () => {
    const tdee = 2500;
    // Fat loss: ~20% deficit (capped 300-500) -> 2500 - 500 = 2000
    expect(calculateCalorieTarget(tdee, 'fat_loss')).toBe(2000);

    // Muscle gain: ~12% surplus (approx 300) -> 2500 + 300 = 2800
    expect(calculateCalorieTarget(tdee, 'muscle_gain')).toBe(2800);

    // Maintenance / Strength: equal to TDEE
    expect(calculateCalorieTarget(tdee, 'maintenance')).toBe(2500);
    expect(calculateCalorieTarget(tdee, 'strength')).toBe(2500);
  });
});
