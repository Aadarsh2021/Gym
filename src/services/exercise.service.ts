import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Exercise } from '@/types/workout.types';
import { logger } from '@/lib/logger';
import { CURATED_EXERCISE_CATALOG } from './exercise-catalog.data';
import { filterExerciseCatalog, ExerciseFilterCriteria } from '@/domain/exercise-search';
import { findExerciseAlternatives } from '@/domain/exercise-alternatives';
import { entitlementService } from '@/services/entitlement.service';

export const FALLBACK_EXERCISES = CURATED_EXERCISE_CATALOG;

/**
 * Normalizes a raw Supabase exercise database record into a clean domain Exercise entity.
 * Fills in structured metadata defaults if the database column has not migrated yet.
 */
function mapDatabaseToDomainExercise(dbRecord: any): Exercise {
  // Check if curated catalog has additional coaching cues for this exercise name
  const curatedMatch = CURATED_EXERCISE_CATALOG.find(
    c => c.name.toLowerCase() === dbRecord.name?.toLowerCase()
  );

  return {
    id: dbRecord.id,
    name: dbRecord.name,
    primaryMuscle: dbRecord.primary_muscle,
    secondaryMuscles: dbRecord.secondary_muscles || [],
    equipmentRequired: dbRecord.equipment_required,
    difficulty: dbRecord.difficulty,
    movementPattern: dbRecord.movement_pattern,
    instructions: dbRecord.instructions || [],
    cues: curatedMatch?.cues || [
      'Maintain controlled tempo throughout the movement.',
      'Breathe out during exertion, breathe in during eccentric lowering.',
    ],
    mistakesToAvoid: curatedMatch?.mistakesToAvoid || [
      'Using excessive body momentum to heave the load.',
    ],
    alternativeExerciseIds: curatedMatch?.alternativeExerciseIds || [],
    targetMusclesDetail: curatedMatch?.targetMusclesDetail || {
      primary: [dbRecord.primary_muscle],
      secondary: dbRecord.secondary_muscles || [],
    },
    muscleGraphicKey: curatedMatch?.muscleGraphicKey,
    demoVideoUrl: dbRecord.demo_video_url || curatedMatch?.demoVideoUrl,
    demoImageUrl: dbRecord.demo_image_url || curatedMatch?.demoImageUrl,
    thumbnailUrl: dbRecord.thumbnail_url || curatedMatch?.thumbnailUrl,
    instructionSteps: (Array.isArray(dbRecord.instruction_steps) && dbRecord.instruction_steps.length > 0)
      ? dbRecord.instruction_steps
      : (curatedMatch?.instructionSteps || []),
    commonMistakes: (Array.isArray(dbRecord.common_mistakes) && dbRecord.common_mistakes.length > 0)
      ? dbRecord.common_mistakes
      : (curatedMatch?.commonMistakes || curatedMatch?.mistakesToAvoid || []),
    visualCues: curatedMatch?.visualCues,
    isSystem: dbRecord.is_system,
  };
}

export const exerciseService = {
  /**
   * Fetch exercises from Supabase with client-side or database-side filtering.
   * Falls back gracefully to curated local catalog when offline or in preview.
   */
  async getExercises(criteria?: ExerciseFilterCriteria): Promise<Exercise[]> {
    if (!isSupabaseConfigured) {
      return filterExerciseCatalog(CURATED_EXERCISE_CATALOG, criteria);
    }

    try {
      let query = supabase.from('exercises').select('*').eq('is_system', true);

      if (criteria?.muscle && criteria.muscle.toLowerCase() !== 'all') {
        query = query.eq('primary_muscle', criteria.muscle);
      }
      if (criteria?.equipment && criteria.equipment.toLowerCase() !== 'all') {
        query = query.eq('equipment_required', criteria.equipment);
      }
      if (criteria?.difficulty && criteria.difficulty.toLowerCase() !== 'all') {
        query = query.eq('difficulty', criteria.difficulty);
      }
      if (criteria?.search) {
        query = query.ilike('name', `%${criteria.search.trim()}%`);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return filterExerciseCatalog(CURATED_EXERCISE_CATALOG, criteria);
      }

      const domainExercises = data.map(mapDatabaseToDomainExercise);
      return filterExerciseCatalog(domainExercises, criteria);
    } catch (err) {
      logger.error('Error fetching exercises from repository', { err });
      return filterExerciseCatalog(CURATED_EXERCISE_CATALOG, criteria);
    }
  },

  /**
   * Get an exercise by ID.
   */
  async getExerciseById(id: string): Promise<Exercise | null> {
    const all = await this.getExercises();
    return all.find(e => e.id === id) || null;
  },

  /**
   * Get exercise alternatives using the deterministic alternatives engine.
   * Gated by server entitlement when userId is provided or session is active.
   */
  async getAlternativesForExercise(target: Exercise, limit = 4, userId?: string): Promise<Exercise[]> {
    if (userId) {
      const entitlement = await entitlementService.assertServerEntitlement(userId);
      if (!entitlement.authorized) {
        throw new Error('PREMIUM_REQUIRED: Exercise & Equipment Alternatives require an active Premium subscription.');
      }
    }
    const all = await this.getExercises();
    return findExerciseAlternatives(target, all, limit);
  },
};
