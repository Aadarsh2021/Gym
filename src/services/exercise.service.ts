import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Exercise } from '@/types/workout.types';
import { logger } from '@/lib/logger';

// Default static catalog for offline/preview mode matching seed.sql
export const FALLBACK_EXERCISES: Exercise[] = [
  { id: 'ex-1', name: 'Barbell Bench Press', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front Delts'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Horizontal Push', instructions: ['Lie flat on bench', 'Lower bar to mid chest with elbows at 45 deg', 'Press up firmly'], isSystem: true },
  { id: 'ex-2', name: 'Incline Dumbbell Press', primaryMuscle: 'Chest', secondaryMuscles: ['Front Delts', 'Triceps'], equipmentRequired: 'Dumbbells', difficulty: 'intermediate', movementPattern: 'Incline Push', instructions: ['Bench at 30 degrees', 'Lower dumbbells to upper chest', 'Press upward'], isSystem: true },
  { id: 'ex-3', name: 'Push-Up', primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Core'], equipmentRequired: 'Bodyweight', difficulty: 'beginner', movementPattern: 'Horizontal Push', instructions: ['Plank position', 'Lower chest to floor', 'Press up'], isSystem: true },
  { id: 'ex-4', name: 'Conventional Deadlift', primaryMuscle: 'Back', secondaryMuscles: ['Hamstrings', 'Glutes', 'Traps'], equipmentRequired: 'Barbell', difficulty: 'advanced', movementPattern: 'Hinge', instructions: ['Stand midfoot under bar', 'Hinge hips to grip bar', 'Lock lats and drive hips up'], isSystem: true },
  { id: 'ex-5', name: 'Barbell Bent-Over Row', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Horizontal Pull', instructions: ['Hinge torso to 45 deg', 'Pull bar to sternum', 'Control lower'], isSystem: true },
  { id: 'ex-6', name: 'Lat Pulldown', primaryMuscle: 'Back', secondaryMuscles: ['Biceps'], equipmentRequired: 'Cable', difficulty: 'beginner', movementPattern: 'Vertical Pull', instructions: ['Wide grip', 'Pull smoothly to upper chest', 'Slowly extend'], isSystem: true },
  { id: 'ex-7', name: 'Barbell Back Squat', primaryMuscle: 'Legs', secondaryMuscles: ['Glutes', 'Core'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Squat', instructions: ['Bar on upper traps', 'Squat until thighs parallel to ground', 'Drive through midfoot'], isSystem: true },
  { id: 'ex-8', name: 'Goblet Squat', primaryMuscle: 'Legs', secondaryMuscles: ['Quads', 'Core'], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Squat', instructions: ['Hold dumbbell at chest', 'Squat deep', 'Drive upward'], isSystem: true },
  { id: 'ex-9', name: 'Overhead Barbell Press', primaryMuscle: 'Shoulders', secondaryMuscles: ['Triceps'], equipmentRequired: 'Barbell', difficulty: 'intermediate', movementPattern: 'Vertical Push', instructions: ['Press bar directly overhead', 'Lockout at top'], isSystem: true },
  { id: 'ex-10', name: 'Dumbbell Lateral Raise', primaryMuscle: 'Shoulders', secondaryMuscles: ['Traps'], equipmentRequired: 'Dumbbells', difficulty: 'beginner', movementPattern: 'Isolation', instructions: ['Raise arms out to sides to shoulder height', 'Lower with control'], isSystem: true },
  { id: 'ex-11', name: 'Barbell Bicep Curl', primaryMuscle: 'Biceps', secondaryMuscles: ['Forearms'], equipmentRequired: 'Barbell', difficulty: 'beginner', movementPattern: 'Flexion', instructions: ['Keep elbows pinned at sides', 'Curl bar up towards chest'], isSystem: true },
  { id: 'ex-12', name: 'Tricep Cable Pushdown', primaryMuscle: 'Triceps', secondaryMuscles: [], equipmentRequired: 'Cable', difficulty: 'beginner', movementPattern: 'Extension', instructions: ['Push bar down to full lockout', 'Squeeze triceps'], isSystem: true },
  { id: 'ex-13', name: 'Plank', primaryMuscle: 'Core', secondaryMuscles: ['Shoulders'], equipmentRequired: 'Bodyweight', difficulty: 'beginner', movementPattern: 'Anti-Extension', instructions: ['Forearm support', 'Rigid straight line', 'Brace core'], isSystem: true },
];

export const exerciseService = {
  async getExercises(filters?: {
    muscle?: string;
    equipment?: string;
    difficulty?: string;
    search?: string;
  }): Promise<Exercise[]> {
    if (!isSupabaseConfigured) {
      return this.filterExercises(FALLBACK_EXERCISES, filters);
    }

    try {
      let query = supabase.from('exercises').select('*').eq('is_system', true);

      if (filters?.muscle && filters.muscle !== 'All') {
        query = query.eq('primary_muscle', filters.muscle);
      }
      if (filters?.equipment && filters.equipment !== 'All') {
        query = query.eq('equipment_required', filters.equipment);
      }
      if (filters?.difficulty && filters.difficulty !== 'All') {
        query = query.eq('difficulty', filters.difficulty);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return this.filterExercises(FALLBACK_EXERCISES, filters);
      }

      return data.map(d => ({
        id: d.id,
        name: d.name,
        primaryMuscle: d.primary_muscle,
        secondaryMuscles: d.secondary_muscles || [],
        equipmentRequired: d.equipment_required,
        difficulty: d.difficulty,
        movementPattern: d.movement_pattern,
        instructions: d.instructions || [],
        isSystem: d.is_system,
      }));
    } catch (err) {
      logger.error('Error fetching exercises', { err });
      return this.filterExercises(FALLBACK_EXERCISES, filters);
    }
  },

  filterExercises(exercises: Exercise[], filters?: {
    muscle?: string;
    equipment?: string;
    difficulty?: string;
    search?: string;
  }): Exercise[] {
    return exercises.filter(ex => {
      if (filters?.muscle && filters.muscle !== 'All' && ex.primaryMuscle.toLowerCase() !== filters.muscle.toLowerCase()) {
        return false;
      }
      if (filters?.equipment && filters.equipment !== 'All' && ex.equipmentRequired.toLowerCase() !== filters.equipment.toLowerCase()) {
        return false;
      }
      if (filters?.difficulty && filters.difficulty !== 'All' && ex.difficulty.toLowerCase() !== filters.difficulty.toLowerCase()) {
        return false;
      }
      if (filters?.search && !ex.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      return true;
    });
  },
};
