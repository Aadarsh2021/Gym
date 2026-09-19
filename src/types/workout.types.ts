export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps' | 'Legs' | 'Core' | 'Glutes';
export type EquipmentType = 'Barbell' | 'Dumbbells' | 'Cable' | 'Bodyweight' | 'Machines' | 'Bands';
export type MovementPattern = 'Horizontal Push' | 'Incline Push' | 'Vertical Push' | 'Horizontal Pull' | 'Vertical Pull' | 'Squat' | 'Hinge' | 'Lunge' | 'Isolation' | 'Arm Flexion' | 'Arm Extension' | 'Anti-Extension' | 'Spine Flexion';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type SessionRating = 'easy' | 'normal' | 'exhausting';
export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

export interface ExerciseVisualCues {
  setup: string;
  movement: string;
  breathing: string;
  commonMistake: string;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipmentRequired: string;
  difficulty: DifficultyLevel;
  movementPattern: string;
  instructions: string[];
  cues?: string[];
  mistakesToAvoid?: string[];
  alternativeExerciseIds?: string[];
  targetMusclesDetail?: {
    primary: string[];
    secondary: string[];
  };
  muscleGraphicKey?: string;
  isSystem: boolean;

  // Phase C8: Visual Exercise Guide Models
  demoVideoUrl?: string;
  demoImageUrl?: string;
  thumbnailUrl?: string;
  visualCues?: ExerciseVisualCues;
  instructionSteps?: string[];
  commonMistakes?: string[];
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
  scheduledDaysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  splitType: string;
  isActive: boolean;
  createdAt?: string;
  days: WorkoutPlanDay[];
}

export interface WorkoutSet {
  id?: string;
  setIndex: number;
  setType?: SetType;
  weightKg: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  completedAt?: string;
  previousPerformance?: {
    weightKg: number;
    reps: number;
    rpe?: number;
  };
}

export interface WorkoutSessionExercise {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  orderIndex: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  restSeconds?: number;
  notes?: string;
  isCore?: boolean;
  sets: WorkoutSet[];
  equipmentRequired?: string;
  demoVideoUrl?: string;
  demoImageUrl?: string;
  thumbnailUrl?: string;
  instructionSteps?: string[];
  instructions?: string[];
  commonMistakes?: string[];
  cues?: string[];
  visualCues?: ExerciseVisualCues;
  exercise?: Exercise;
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
  gymId?: string | null;
  gymVerified?: boolean;
  qualityScore?: number | null;
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

export interface PRHistoryEvent {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName?: string;
  weightKg: number;
  reps: number;
  estimatedOneRepMax: number;
  achievedAt: string;
  sessionId?: string | null;
  createdAt?: string;
}

