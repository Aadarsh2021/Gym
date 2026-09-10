import { describe, it, expect } from 'vitest';
import { evaluateProgression } from '@/domain/progression';
import { WorkoutSet } from '@/types/workout.types';

describe('Conservative Progressive Overload Domain Engine', () => {
  it('cues load increase when all working sets hit the top of the rep range with controlled RPE', () => {
    const sets: WorkoutSet[] = [
      { setIndex: 1, setType: 'normal', weightKg: 80, reps: 10, rpe: 7.5, completed: true },
      { setIndex: 2, setType: 'normal', weightKg: 80, reps: 10, rpe: 8, completed: true },
      { setIndex: 3, setType: 'normal', weightKg: 80, reps: 10, rpe: 8.5, completed: true },
    ];

    const result = evaluateProgression({
      exerciseName: 'Barbell Bench Press',
      primaryMuscle: 'Chest',
      targetRepsMin: 8,
      targetRepsMax: 10,
      currentSets: sets,
    });

    expect(result.action).toBe('increase_load');
    expect(result.suggestedIncrementKg).toBe(2.5); // 2.5 kg for upper body
    expect(result.cue).toContain('+2.5 kg');
  });

  it('recommends +5 kg for lower body compound movements upon top rep completion', () => {
    const sets: WorkoutSet[] = [
      { setIndex: 1, setType: 'normal', weightKg: 100, reps: 6, rpe: 8, completed: true },
      { setIndex: 2, setType: 'normal', weightKg: 100, reps: 6, rpe: 8, completed: true },
      { setIndex: 3, setType: 'normal', weightKg: 100, reps: 6, rpe: 8.5, completed: true },
    ];

    const result = evaluateProgression({
      exerciseName: 'Barbell Back Squat',
      primaryMuscle: 'Legs',
      targetRepsMin: 4,
      targetRepsMax: 6,
      currentSets: sets,
    });

    expect(result.action).toBe('increase_load');
    expect(result.suggestedIncrementKg).toBe(5); // 5 kg for lower body
    expect(result.cue).toContain('+5 kg');
  });

  it('strictly ignores warmup and drop sets when calculating progression recommendations', () => {
    const sets: WorkoutSet[] = [
      // Warmup set: 15 reps, light load - should NOT count as exceeding target reps
      { setIndex: 1, setType: 'warmup', weightKg: 40, reps: 15, rpe: 5, completed: true },
      // Working sets: only 8 reps (fell short of max 10)
      { setIndex: 2, setType: 'normal', weightKg: 80, reps: 8, rpe: 8.5, completed: true },
      { setIndex: 3, setType: 'normal', weightKg: 80, reps: 8, rpe: 9, completed: true },
      // Drop set: 12 reps - should NOT count as double progression
      { setIndex: 4, setType: 'drop', weightKg: 50, reps: 12, rpe: 9, completed: true },
    ];

    const result = evaluateProgression({
      exerciseName: 'Barbell Bench Press',
      primaryMuscle: 'Chest',
      targetRepsMin: 8,
      targetRepsMax: 10,
      currentSets: sets,
    });

    // Should recommend consolidation, NOT load increase
    expect(result.action).toBe('consolidate');
  });

  it('cues load reduction when exertion is near absolute failure (RPE >= 9.5) and reps are missed', () => {
    const sets: WorkoutSet[] = [
      { setIndex: 1, setType: 'normal', weightKg: 90, reps: 6, rpe: 9.5, completed: true },
      { setIndex: 2, setType: 'normal', weightKg: 90, reps: 5, rpe: 10, completed: true },
    ];

    const result = evaluateProgression({
      exerciseName: 'Barbell Bench Press',
      primaryMuscle: 'Chest',
      targetRepsMin: 8,
      targetRepsMax: 10,
      currentSets: sets,
    });

    expect(result.action).toBe('reduce_load');
    expect(result.cue).toContain('reducing load');
  });
});
