import { describe, it, expect } from 'vitest';
import { calculateProteinTarget, calculateMacroSplit } from '@/domain/protein';

describe('Protein Domain Engine', () => {
  it('should calculate target protein based on bodyweight and fitness goal', () => {
    const weightKg = 75;

    // Muscle gain (2.0 g/kg)
    expect(calculateProteinTarget(weightKg, 'muscle_gain')).toBe(150);

    // Fat loss (2.2 g/kg) -> 75 * 2.2 = 165
    expect(calculateProteinTarget(weightKg, 'fat_loss')).toBe(165);

    // Maintenance (1.6 g/kg) -> 75 * 1.6 = 120
    expect(calculateProteinTarget(weightKg, 'maintenance')).toBe(120);
  });

  it('should enforce safe floor on protein target for low weights', () => {
    // Very low weight (e.g. 15kg or edge cases) should not drop below physiological floor 45g
    expect(calculateProteinTarget(15, 'maintenance')).toBe(45);
    expect(calculateProteinTarget(0, 'muscle_gain')).toBe(0);
    expect(calculateProteinTarget(-50, 'muscle_gain')).toBe(0);
  });

  it('should generate balanced macronutrient splits totaling the target calories', () => {
    const targetCalories = 2000;
    const targetProteinG = 150; // 150 * 4 = 600 kcal

    const macros = calculateMacroSplit(targetCalories, targetProteinG);

    expect(macros.proteinG).toBe(150);
    // Fat: 25% of 2000 = 500 kcal / 9 = ~56g
    expect(macros.fatG).toBe(56);
    // Carbs: (2000 - (600 + 500)) / 4 = 900 / 4 = 225g
    expect(macros.carbsG).toBe(225);
  });
});
