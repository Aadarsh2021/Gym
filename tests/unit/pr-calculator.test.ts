import { describe, it, expect } from 'vitest';
import {
  calculateOneRepMaxEpley,
  calculateOneRepMaxBrzycki,
  checkPersonalRecord,
} from '@/domain/pr-calculator';

describe('PR & 1RM Calculation Engine', () => {
  it('should calculate accurate Epley 1RM', () => {
    // 100kg x 10 reps -> 100 * (1 + 10/30) = 100 * 1.3333 = 133.3 kg
    expect(calculateOneRepMaxEpley(100, 10)).toBe(133.3);

    // 1 rep -> weight itself
    expect(calculateOneRepMaxEpley(120, 1)).toBe(120);

    // Edge cases
    expect(calculateOneRepMaxEpley(0, 10)).toBe(0);
    expect(calculateOneRepMaxEpley(100, 0)).toBe(0);
    expect(calculateOneRepMaxEpley(-100, 10)).toBe(0);
  });

  it('should calculate accurate Brzycki 1RM for low rep ranges', () => {
    // 100kg x 5 reps -> 100 * (36 / 32) = 112.5 kg
    expect(calculateOneRepMaxBrzycki(100, 5)).toBe(112.5);

    // 1 rep
    expect(calculateOneRepMaxBrzycki(140, 1)).toBe(140);
  });

  it('should correctly identify when a performance sets a new PR', () => {
    const existingPR = {
      weightKg: 80,
      reps: 8,
      estimatedOneRepMax: 101.3,
    };

    // Case 1: Higher weight lifted (85kg x 8)
    const result1 = checkPersonalRecord(85, 8, existingPR);
    expect(result1.isNewWeightPR).toBe(true);
    expect(result1.isNew1RMPR).toBe(true);

    // Case 2: Same weight, more reps (80kg x 10)
    const result2 = checkPersonalRecord(80, 10, existingPR);
    expect(result2.isNewWeightPR).toBe(false);
    expect(result2.isNewRepPR).toBe(true);
    expect(result2.isNew1RMPR).toBe(true);

    // Case 3: Lower performance (75kg x 6)
    const result3 = checkPersonalRecord(75, 6, existingPR);
    expect(result3.isNewWeightPR).toBe(false);
    expect(result3.isNewRepPR).toBe(false);
    expect(result3.isNew1RMPR).toBe(false);
  });
});
