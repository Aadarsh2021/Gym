export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Legs' | 'Core' | 'Glutes';
export type EquipmentType = 'Barbell' | 'Dumbbells' | 'Cable' | 'Bodyweight' | 'Machines' | 'Bands';
export type SessionRating = 'easy' | 'normal' | 'exhausting';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipmentRequired: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  movementPattern: string;
  instructions: string[];
  isSystem: boolean;
}

export interface WorkoutPlanExercise {
  id: string;
  planDayId: string;
  exerciseId: string;
  exercise?: Exercise;
  orderIndex: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  restSeconds: number;
  isCore: boolean;
}

export interface WorkoutPlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  name: string;
  targetMuscleGroups: string[];
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  splitType: string;
  isActive: boolean;
  days: WorkoutPlanDay[];
}

export interface WorkoutSet {
  id?: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  completedAt?: string;
}

export interface WorkoutSessionExercise {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  orderIndex: number;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string | null;
  name: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  idempotencyKey?: string | null;
  startedAt: string;
  completedAt?: string | null;
  durationSeconds: number;
  sessionRating?: SessionRating;
  notes?: string;
  exercises: WorkoutSessionExercise[];
}

export interface PersonalRecord {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName?: string;
  weightKg: number;
  reps: number;
  estimatedOneRepMax: number;
  achievedAt: string;
}
