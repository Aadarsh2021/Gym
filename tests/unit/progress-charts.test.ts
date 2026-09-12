import { describe, it, expect, beforeEach } from 'vitest';
import { calculateOneRepMaxEpley } from '@/domain/pr-calculator';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { WorkoutSession } from '@/types/workout.types';
import { progressService } from '@/services/progress.service';
import fs from 'fs';
import path from 'path';

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

describe('Progress Charts & Analytics Suite', () => {
  const userId = 'athlete-charts-001';

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Strength Progression Data Extraction', () => {
    const mockSessions: WorkoutSession[] = [
      {
        id: 'session-1',
        userId,
        name: 'Upper Body A',
        status: 'completed',
        startedAt: '2026-09-01T10:00:00Z',
        durationSeconds: 3000,
        exercises: [
          {
            exerciseId: 'ex-bench-press',
            exerciseName: 'Barbell Bench Press',
            primaryMuscle: 'Chest',
            orderIndex: 1,
            sets: [
              { setIndex: 1, setType: 'normal', weightKg: 80, reps: 8, completed: true },
              { setIndex: 2, setType: 'normal', weightKg: 80, reps: 8, completed: true },
              { setIndex: 3, setType: 'normal', weightKg: 85, reps: 6, completed: true },
            ],
          },
        ],
      },
      {
        id: 'session-2',
        userId,
        name: 'Upper Body B',
        status: 'completed',
        startedAt: '2026-09-08T10:00:00Z',
        durationSeconds: 3200,
        exercises: [
          {
            exerciseId: 'ex-bench-press',
            exerciseName: 'Barbell Bench Press',
            primaryMuscle: 'Chest',
            orderIndex: 1,
            sets: [
              { setIndex: 1, setType: 'normal', weightKg: 85, reps: 8, completed: true },
              { setIndex: 2, setType: 'normal', weightKg: 90, reps: 6, completed: true },
            ],
          },
        ],
      },
    ];

    it('correctly calculates top set weight and estimated 1RM trajectory over time', () => {
      // Session 1: 85kg x 6 reps -> 1RM = 85 * (1 + 6/30) = 102 kg
      const s1Sets = mockSessions[0].exercises[0].sets.filter(s => s.completed);
      const topWeight1 = Math.max(...s1Sets.map(s => s.weightKg));
      expect(topWeight1).toBe(85);

      const e1rm1 = Math.max(...s1Sets.map(s => calculateOneRepMaxEpley(s.weightKg, s.reps)));
      expect(e1rm1).toBe(102);

      // Session 2: 90kg x 6 reps -> 1RM = 90 * (1 + 6/30) = 108 kg
      const s2Sets = mockSessions[1].exercises[0].sets.filter(s => s.completed);
      const topWeight2 = Math.max(...s2Sets.map(s => s.weightKg));
      expect(topWeight2).toBe(90);

      const e1rm2 = Math.max(...s2Sets.map(s => calculateOneRepMaxEpley(s.weightKg, s.reps)));
      expect(e1rm2).toBe(108);

      // Trajectory shows positive progression
      expect(topWeight2).toBeGreaterThan(topWeight1);
      expect(e1rm2).toBeGreaterThan(e1rm1);
    });
  });

  describe('Training Volume (Tonnage) Aggregation', () => {
    it('aggregates total workload correctly across multiple exercises and sets', () => {
      const session: WorkoutSession = {
        id: 'session-volume-test',
        userId,
        name: 'Full Body Compound',
        status: 'completed',
        startedAt: '2026-09-10T10:00:00Z',
        durationSeconds: 3600,
        exercises: [
          {
            exerciseId: 'ex-squat',
            exerciseName: 'Barbell Back Squat',
            primaryMuscle: 'Quads',
            orderIndex: 1,
            sets: [
              { setIndex: 1, setType: 'normal', weightKg: 100, reps: 5, completed: true }, // 500
              { setIndex: 2, setType: 'normal', weightKg: 100, reps: 5, completed: true }, // 500
              { setIndex: 3, setType: 'normal', weightKg: 100, reps: 5, completed: false }, // Ignored
            ],
          },
          {
            exerciseId: 'ex-bench',
            exerciseName: 'Barbell Bench Press',
            primaryMuscle: 'Chest',
            orderIndex: 2,
            sets: [
              { setIndex: 1, setType: 'normal', weightKg: 80, reps: 10, completed: true }, // 800
            ],
          },
        ],
      };

      const summary = calculateWorkoutSummary(session, {});
      // Expected total volume: (100*5) + (100*5) + (80*10) = 1800 kg
      expect(summary.totalVolumeKg).toBe(1800);
      expect(summary.totalCompletedSets).toBe(3);
    });
  });

  describe('Body Weight Trend Service & Math', () => {
    it('logs weight entries, sorts chronologically, and calculates net delta', async () => {
      await progressService.logWeight(userId, 76.5, '2026-09-01', 'Baseline');
      await progressService.logWeight(userId, 75.8, '2026-09-08', 'Week 1');
      await progressService.logWeight(userId, 75.2, '2026-09-15', 'Week 2');

      const entries = await progressService.getProgressEntries(userId);
      expect(entries.length).toBe(3);
      expect(entries[0].weightKg).toBe(76.5);
      expect(entries[2].weightKg).toBe(75.2);

      const netDelta = Math.round((entries[2].weightKg - entries[0].weightKg) * 10) / 10;
      expect(netDelta).toBe(-1.3);

      // Deletion test
      await progressService.deleteProgressEntry(userId, entries[1].id);
      const updated = await progressService.getProgressEntries(userId);
      expect(updated.length).toBe(2);
      expect(updated.find(e => e.id === entries[1].id)).toBeUndefined();
    });
  });

  describe('Color Compliance & Token Audit (Rule 6)', () => {
    it('verifies strict adherence to #3B4B6B and absence of forbidden colors/gradients in chart files', () => {
      const volumeChartCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/charts/VolumeChart.tsx'),
        'utf-8'
      );
      const strengthChartCode = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/charts/StrengthProgressChart.tsx'),
        'utf-8'
      );
      const cssVariables = fs.readFileSync(
        path.resolve(process.cwd(), 'src/styles/variables.css'),
        'utf-8'
      );

      // 1. Forbidden hex codes must NOT exist in chart components or CSS accent-indigo
      const forbiddenHexes = ['#4F46E5', '#4f46e5', '#6366F1', '#6366f1'];
      for (const hex of forbiddenHexes) {
        expect(volumeChartCode).not.toContain(hex);
        expect(strengthChartCode).not.toContain(hex);
      }

      // 2. CSS variables must resolve --accent-indigo to #6279A6
      expect(cssVariables).toContain('--accent-indigo: #6279A6;');

      // 3. Volume chart must NOT have an indigo->emerald gradient
      expect(volumeChartCode.toLowerCase()).not.toContain('gradient');
      expect(volumeChartCode.toLowerCase()).not.toContain('emerald');
    });
  });
});
