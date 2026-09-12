import { describe, it, expect, beforeEach } from 'vitest';
import { foodDiaryService } from '@/services/food-diary.service';
import { nutritionService } from '@/services/nutrition.service';

// In-memory localStorage mock for node test environment
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = String(val); },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => {
    Object.keys(storage).forEach(k => delete storage[k]);
  },
};
(globalThis as any).localStorage = mockLocalStorage;

describe('Food Diary & Deterministic Meal Planner Suite', () => {
  const userId = 'athlete-nutrition-001';
  const todayStr = '2026-09-12';

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Food Diary Service', () => {
    it('logs entries and computes daily macro totals accurately', async () => {
      // 1. Initially empty
      const initialTotals = await foodDiaryService.getDailyMacroTotals(userId, todayStr);
      expect(initialTotals.totalCalories).toBe(0);
      expect(initialTotals.totalProteinG).toBe(0);
      expect(initialTotals.entriesCount).toBe(0);

      // 2. Log breakfast
      const entry1 = await foodDiaryService.logFoodEntry({
        userId,
        loggedDate: todayStr,
        mealType: 'breakfast',
        foodName: 'Boiled Eggs (3 large)',
        servings: 1.5,
        calories: 230,
        proteinG: 18,
        carbsG: 1.5,
        fatG: 15,
      });
      expect(entry1.success).toBe(true);
      expect(entry1.entry?.id).toBeDefined();

      // 3. Log lunch
      const entry2 = await foodDiaryService.logFoodEntry({
        userId,
        loggedDate: todayStr,
        mealType: 'lunch',
        foodName: 'Paneer Bhurji & Roti',
        servings: 1.0,
        calories: 520,
        proteinG: 28,
        carbsG: 45,
        fatG: 22,
      });
      expect(entry2.success).toBe(true);

      // 4. Verify aggregated totals
      const totals = await foodDiaryService.getDailyMacroTotals(userId, todayStr);
      expect(totals.totalCalories).toBe(750);
      expect(totals.totalProteinG).toBe(46);
      expect(totals.totalCarbsG).toBe(46.5);
      expect(totals.totalFatG).toBe(37);
      expect(totals.entriesCount).toBe(2);

      // 5. Verify getDiaryEntries returns both entries in order
      const entries = await foodDiaryService.getDiaryEntries(userId, todayStr);
      expect(entries.length).toBe(2);
      expect(entries[0].foodName).toBe('Boiled Eggs (3 large)');
      expect(entries[1].foodName).toBe('Paneer Bhurji & Roti');

      // 6. Delete one entry and check updated totals
      if (entry1.entry?.id) {
        await foodDiaryService.deleteFoodEntry(userId, entry1.entry.id, todayStr);
      }
      const updatedTotals = await foodDiaryService.getDailyMacroTotals(userId, todayStr);
      expect(updatedTotals.totalCalories).toBe(520);
      expect(updatedTotals.totalProteinG).toBe(28);
      expect(updatedTotals.entriesCount).toBe(1);
    });
  });

  describe('Deterministic Meal Planner Service', () => {
    it('generates a 4-slot balanced plan respecting dietary preferences and realistic bounds', async () => {
      const plan = await nutritionService.generateAndSaveMealPlan(
        userId,
        2200,
        140,
        'veg'
      );

      expect(plan).toBeDefined();
      expect(plan!.targetCalories).toBe(2200);
      expect(plan!.targetProteinG).toBe(140);
      expect(plan!.items.length).toBeGreaterThanOrEqual(4);

      // Check all 4 meal slots are covered
      const slots = new Set(plan!.items.map(item => item.mealType));
      expect(slots.has('breakfast')).toBe(true);
      expect(slots.has('lunch')).toBe(true);
      expect(slots.has('snack')).toBe(true);
      expect(slots.has('dinner')).toBe(true);

      // Check serving bounds (0.5 to 3.0)
      for (const item of plan!.items) {
        expect(item.servings).toBeGreaterThanOrEqual(0.5);
        expect(item.servings).toBeLessThanOrEqual(3.0);
        expect(item.calculatedCalories).toBeGreaterThan(0);
        expect(item.calculatedProteinG).toBeGreaterThan(0);
      }

      // Check plan persistence
      const savedPlan = await nutritionService.getMealPlan(userId);
      expect(savedPlan).toBeDefined();
      expect(savedPlan?.items.length).toBeGreaterThanOrEqual(4);
    });

    it('generates non-veg plan when user preference is non_veg', async () => {
      const plan = await nutritionService.generateAndSaveMealPlan(
        userId,
        2400,
        160,
        'non_veg'
      );

      expect(plan).toBeDefined();
      expect(plan!.items.length).toBeGreaterThanOrEqual(4);
      const totalCal = plan!.items.reduce((s, i) => s + i.calculatedCalories, 0);
      const totalProt = plan!.items.reduce((s, i) => s + i.calculatedProteinG, 0);

      // Must be within reasonable tolerance of targets
      expect(totalCal).toBeGreaterThan(1500);
      expect(totalProt).toBeGreaterThan(80);
    });
  });
});
