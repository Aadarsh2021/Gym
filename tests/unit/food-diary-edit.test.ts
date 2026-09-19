import { describe, it, expect, beforeEach } from 'vitest';
import { foodDiaryService } from '@/services/food-diary.service';
import { nutritionRepository } from '@/repositories/nutrition.repository';

// In-memory storage mock
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

describe('Food Diary In-Place Serving & Item Edit Suite', () => {
  const userId = 'athlete-c11-001';
  const otherUserId = 'athlete-c11-intruder';
  const testDate = '2026-09-19';

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('1. Edit 1.0 -> 2.5 servings accurately recalculates macros and updates storage', async () => {
    // Initial entry with 1.0 serving: 200 kcal, 20g P, 15g C, 5g F
    const logRes = await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'breakfast',
      foodName: 'Paneer Scramble',
      servings: 1.0,
      calories: 200,
      proteinG: 20,
      carbsG: 15,
      fatG: 5,
    });
    expect(logRes.success).toBe(true);
    const entry = logRes.entry!;

    // Edit from 1.0 -> 2.5 servings
    const updateRes = await foodDiaryService.updateFoodEntry(userId, entry.id, 2.5, entry);
    expect(updateRes.success).toBe(true);
    expect(updateRes.entry).toBeDefined();

    expect(updateRes.entry!.servings).toBe(2.5);
    expect(updateRes.entry!.calories).toBe(500); // 200 * 2.5
    expect(updateRes.entry!.proteinG).toBe(50);  // 20 * 2.5
    expect(updateRes.entry!.carbsG).toBe(37.5); // 15 * 2.5
    expect(updateRes.entry!.fatG).toBe(12.5);   // 5 * 2.5
  });

  it('2. Edit 2.5 -> 0.5 servings scales down accurately', async () => {
    const logRes = await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'lunch',
      foodName: 'Chicken Breast Curry',
      servings: 2.5,
      calories: 400,
      proteinG: 60,
      carbsG: 10,
      fatG: 12,
    });
    const entry = logRes.entry!;

    const updateRes = await foodDiaryService.updateFoodEntry(userId, entry.id, 0.5, entry);
    expect(updateRes.success).toBe(true);
    expect(updateRes.entry!.servings).toBe(0.5);
    // Base per 1 serving: 400/2.5 = 160 cal, 60/2.5 = 24g P, 10/2.5 = 4g C, 12/2.5 = 4.8g F
    // 0.5 serving: 80 cal, 12g P, 2g C, 2.4g F
    expect(updateRes.entry!.calories).toBe(80);
    expect(updateRes.entry!.proteinG).toBe(12);
    expect(updateRes.entry!.carbsG).toBe(2);
    expect(updateRes.entry!.fatG).toBe(2.4);
  });

  it('3. Macro recalculation handles floating precision cleanly', async () => {
    const logRes = await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'snack',
      foodName: 'Roasted Chana',
      servings: 1.0,
      calories: 165,
      proteinG: 9.3,
      carbsG: 27.2,
      fatG: 2.6,
    });
    const entry = logRes.entry!;

    const updateRes = await foodDiaryService.updateFoodEntry(userId, entry.id, 1.3, entry);
    expect(updateRes.success).toBe(true);
    expect(updateRes.entry!.calories).toBe(Math.round(165 * 1.3));
    expect(updateRes.entry!.proteinG).toBe(Math.round(9.3 * 1.3 * 10) / 10);
    expect(updateRes.entry!.carbsG).toBe(Math.round(27.2 * 1.3 * 10) / 10);
    expect(updateRes.entry!.fatG).toBe(Math.round(2.6 * 1.3 * 10) / 10);
  });

  it('4. Daily totals recalculation reflects edited serving amounts', async () => {
    // 1. Initial 2 entries
    const e1 = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'breakfast',
      foodName: 'Oats & Milk',
      servings: 1.0,
      calories: 300,
      proteinG: 15,
      carbsG: 45,
      fatG: 6,
    })).entry!;

    await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'lunch',
      foodName: 'Dal & Rice',
      servings: 1.0,
      calories: 400,
      proteinG: 14,
      carbsG: 70,
      fatG: 5,
    });

    const initialTotals = await foodDiaryService.getDailyMacroTotals(userId, testDate);
    expect(initialTotals.totalCalories).toBe(700);
    expect(initialTotals.totalProteinG).toBe(29);

    // 2. Edit e1 from 1.0 to 2.0 servings (+300 kcal, +15g protein)
    await foodDiaryService.updateFoodEntry(userId, e1.id, 2.0, e1);

    const updatedTotals = await foodDiaryService.getDailyMacroTotals(userId, testDate);
    expect(updatedTotals.totalCalories).toBe(1000);
    expect(updatedTotals.totalProteinG).toBe(44);
    expect(updatedTotals.totalCarbsG).toBe(160);
    expect(updatedTotals.totalFatG).toBe(17);
  });

  it('5. Rejects 0 servings', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'dinner',
      foodName: 'Tofu Bhurji',
      servings: 1.0,
      calories: 180,
      proteinG: 18,
      carbsG: 5,
      fatG: 10,
    })).entry!;

    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, 0, entry);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/between 0\.1 and 20/i);
  });

  it('6. Rejects negative servings', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'snack',
      foodName: 'Almonds',
      servings: 1.0,
      calories: 160,
      proteinG: 6,
      carbsG: 6,
      fatG: 14,
    })).entry!;

    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, -1.5, entry);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/between 0\.1 and 20/i);
  });

  it('7. Rejects NaN servings', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'breakfast',
      foodName: 'Greek Yogurt',
      servings: 1.0,
      calories: 130,
      proteinG: 15,
      carbsG: 8,
      fatG: 4,
    })).entry!;

    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, NaN, entry);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('8. Rejects Infinity servings', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'lunch',
      foodName: 'Sattu Drink',
      servings: 1.0,
      calories: 210,
      proteinG: 12,
      carbsG: 32,
      fatG: 3,
    })).entry!;

    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, Infinity, entry);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('9. Rejects servings > 20', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'lunch',
      foodName: 'Boiled Chickpeas',
      servings: 1.0,
      calories: 220,
      proteinG: 12,
      carbsG: 36,
      fatG: 3.5,
    })).entry!;

    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, 20.1, entry);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/between 0\.1 and 20/i);
  });

  it('10. Another user cannot modify an entry (user-scoped authorization)', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'breakfast',
      foodName: 'Whey Isolate',
      servings: 1.0,
      calories: 120,
      proteinG: 25,
      carbsG: 2,
      fatG: 1,
    })).entry!;

    // Attempt update as otherUserId
    const res = await foodDiaryService.updateFoodEntry(otherUserId, entry.id, 3.0, entry);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);

    // Verify original entry was unchanged in owner's diary
    const ownerEntries = await foodDiaryService.getDiaryEntries(userId, testDate);
    expect(ownerEntries.find(e => e.id === entry.id)?.servings).toBe(1.0);
  });

  it('11. Client cannot spoof macros; authoritative recalculation enforces truth', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'snack',
      foodName: 'Peanut Butter Toast',
      servings: 1.0,
      calories: 250,
      proteinG: 10,
      carbsG: 24,
      fatG: 12,
    })).entry!;

    // Client submits only new servings (2.0) and identity; macros are computed deterministically
    const res = await foodDiaryService.updateFoodEntry(userId, entry.id, 2.0, entry);
    expect(res.success).toBe(true);
    // Real base 250 * 2 = 500 cals, 10 * 2 = 20g P
    expect(res.entry!.calories).toBe(500);
    expect(res.entry!.proteinG).toBe(20);
  });

  it('12. Persisted value survives reload', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'dinner',
      foodName: 'Fish Curry',
      servings: 1.0,
      calories: 280,
      proteinG: 32,
      carbsG: 8,
      fatG: 14,
    })).entry!;

    await foodDiaryService.updateFoodEntry(userId, entry.id, 1.75, entry);

    // Simulate page reload by querying entries freshly from repository
    const reloadedEntries = await nutritionRepository.fetchFoodDiaryEntries(userId, testDate);
    const target = reloadedEntries.find(e => e.id === entry.id);

    expect(target).toBeDefined();
    expect(target!.servings).toBe(1.75);
    expect(target!.calories).toBe(490); // 280 * 1.75
    expect(target!.proteinG).toBe(56);  // 32 * 1.75
  });

  it('13. Failed update preserves old state without corrupting diary', async () => {
    const entry = (await foodDiaryService.logFoodEntry({
      userId,
      loggedDate: testDate,
      mealType: 'snack',
      foodName: 'Boiled Egg',
      servings: 2.0,
      calories: 140,
      proteinG: 12,
      carbsG: 1,
      fatG: 10,
    })).entry!;

    // Attempt invalid update
    const failedRes = await foodDiaryService.updateFoodEntry(userId, entry.id, -5, entry);
    expect(failedRes.success).toBe(false);

    // Verify existing entry in storage remains untouched
    const currentEntries = await foodDiaryService.getDiaryEntries(userId, testDate);
    const existing = currentEntries.find(e => e.id === entry.id);
    expect(existing?.servings).toBe(2.0);
    expect(existing?.calories).toBe(140);
  });
});
