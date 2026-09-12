export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          unit_system: 'metric' | 'imperial';
          timezone: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          unit_system?: 'metric' | 'imperial';
          timezone?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      fitness_profiles: {
        Row: {
          id: string;
          user_id: string;
          age: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          gender: 'male' | 'female' | 'other' | null;
          goal: 'muscle_gain' | 'fat_loss' | 'maintenance' | 'strength' | 'endurance';
          experience_level: 'beginner' | 'intermediate' | 'advanced';
          days_per_week: number;
          workout_duration_minutes: number;
          equipment: string[];
          dietary_preference: 'vegetarian' | 'vegan' | 'eggetarian' | 'non_vegetarian';
          limitations: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fitness_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fitness_profiles']['Insert']>;
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          primary_muscle: string;
          secondary_muscles: string[];
          equipment_required: string;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          movement_pattern: string;
          instructions: string[];
          is_system: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>;
      };
      workout_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          split_type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workout_plans']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_plans']['Insert']>;
      };
      workout_plan_days: {
        Row: {
          id: string;
          plan_id: string;
          day_number: number;
          name: string;
          target_muscle_groups: string[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workout_plan_days']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_plan_days']['Insert']>;
      };
      workout_plan_exercises: {
        Row: {
          id: string;
          plan_day_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_reps_min: number;
          target_reps_max: number;
          rest_seconds: number;
          is_core: boolean;
        };
        Insert: Omit<Database['public']['Tables']['workout_plan_exercises']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_plan_exercises']['Insert']>;
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string | null;
          name: string;
          status: 'in_progress' | 'completed' | 'cancelled';
          idempotency_key: string | null;
          started_at: string;
          completed_at: string | null;
          duration_seconds: number;
          session_rating: 'easy' | 'normal' | 'exhausting' | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workout_sessions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_sessions']['Insert']>;
      };
      workout_session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['workout_session_exercises']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_session_exercises']['Insert']>;
      };
      workout_sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          set_index: number;
          weight_kg: number;
          reps: number;
          rpe: number | null;
          completed: boolean;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['workout_sets']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['workout_sets']['Insert']>;
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          weight_kg: number;
          reps: number;
          estimated_one_rep_max: number;
          achieved_at: string;
          session_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['personal_records']['Row'], 'id' | 'achieved_at'> & {
          id?: string;
          achieved_at?: string;
        };
        Update: Partial<Database['public']['Tables']['personal_records']['Insert']>;
      };
      progress_entries: {
        Row: {
          id: string;
          user_id: string;
          recorded_date: string;
          weight_kg: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['progress_entries']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['progress_entries']['Insert']>;
      };
      foods: {
        Row: {
          id: string;
          name: string;
          serving_size: string;
          serving_unit: string;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          dietary_type: 'veg' | 'non_veg' | 'egg' | 'vegan';
          source: string;
          source_reference: string | null;
          is_verified: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['foods']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['foods']['Insert']>;
      };
      nutrition_profiles: {
        Row: {
          id: string;
          user_id: string;
          bmr_calories: number;
          tdee_calories: number;
          target_calories: number;
          target_protein_g: number;
          target_carbs_g: number;
          target_fat_g: number;
          calculation_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['nutrition_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['nutrition_profiles']['Insert']>;
      };
      meal_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_calories: number;
          target_protein_g: number;
          is_active: boolean;
          plan_kind: 'standard' | 'budget' | 'replacement_derived';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['meal_plans']['Row'], 'id' | 'created_at'> & {
          id?: string;
          plan_kind?: 'standard' | 'budget' | 'replacement_derived';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['meal_plans']['Insert']>;
      };
      meal_plan_items: {
        Row: {
          id: string;
          meal_plan_id: string;
          food_id: string;
          meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
          servings: number;
          calculated_calories: number;
          calculated_protein_g: number;
          is_replacement: boolean;
        };
        Insert: Omit<Database['public']['Tables']['meal_plan_items']['Row'], 'id'> & {
          id?: string;
          is_replacement?: boolean;
        };
        Update: Partial<Database['public']['Tables']['meal_plan_items']['Insert']>;
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['streaks']['Row'], 'id' | 'updated_at'> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['streaks']['Insert']>;
      };
      streak_events: {
        Row: {
          id: string;
          user_id: string;
          event_date: string;
          event_type: 'workout_completed' | 'rest_day' | 'revive';
          session_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['streak_events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['streak_events']['Insert']>;
      };
      streak_revives: {
        Row: {
          id: string;
          user_id: string;
          used_at: string;
          restored_streak: number;
        };
        Insert: Omit<Database['public']['Tables']['streak_revives']['Row'], 'id' | 'used_at'> & {
          id?: string;
          used_at?: string;
        };
        Update: Partial<Database['public']['Tables']['streak_revives']['Insert']>;
      };
      achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: string;
          unlocked_at: string;
        };
        Insert: Omit<Database['public']['Tables']['achievements']['Row'], 'id' | 'unlocked_at'> & {
          id?: string;
          unlocked_at?: string;
        };
        Update: Partial<Database['public']['Tables']['achievements']['Insert']>;
      };
      fitness_coins: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          source: string;
          reference_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fitness_coins']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fitness_coins']['Insert']>;
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_conversations']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_conversations']['Insert']>;
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_messages']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_messages']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'workout_reminder' | 'milestone' | 'alarm';
          notification_style: 'basic' | 'gentle' | 'motivational' | 'tough_love';
          scheduled_time: string | null;
          scheduled_days: number[];
          is_read: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string;
          notification_style?: 'basic' | 'gentle' | 'motivational' | 'tough_love';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
    };
    Functions: {
      complete_workout_session: {
        Args: {
          p_session_id: string;
          p_idempotency_key: string;
          p_session_rating: string;
          p_notes: string;
        };
        Returns: Json;
      };
      use_streak_revive: {
        Args: {
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      replace_meal_plan_item: {
        Args: {
          p_item_id: string;
          p_new_food_id: string;
          p_servings: number;
          p_calculated_calories: number;
          p_calculated_protein_g: number;
        };
        Returns: Database['public']['Tables']['meal_plan_items']['Row'];
      };
    };
  };
}
