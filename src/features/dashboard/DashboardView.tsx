import React from 'react';
import { Play, Flame, Utensils, Sparkles, ChevronRight, Zap } from 'lucide-react';
import { WorkoutPlan } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile } from '@/types/nutrition.types';

interface DashboardViewProps {
  activePlan: WorkoutPlan | null;
  streak: UserStreak;
  nutritionProfile: NutritionProfile | null;
  onStartWorkout: () => void;
  onOpenGuruJi: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenGenerator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activePlan,
  streak,
  nutritionProfile,
  onStartWorkout,
  onOpenGuruJi,
  onNavigateTab,
  onOpenGenerator,
}) => {
  const todayWorkoutDay = activePlan?.days?.[0];

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* Welcome Banner */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-lime">Active System</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Phase 1 Core</span>
        </div>
        <h1>What Should I Do Today?</h1>
        <p>Your personalized workout, nutrition targets, and consistency metrics.</p>
      </div>

      {/* Main Grid */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* TODAY'S WORKOUT CARD */}
        <div className="card card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{ padding: '8px', background: 'rgba(212, 255, 0, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                  <Zap size={22} />
                </div>
                <div>
                  <small style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Mission</small>
                  <h3>{todayWorkoutDay ? todayWorkoutDay.name : 'No Active Routine'}</h3>
                </div>
              </div>
              <span className="badge badge-lime">Day 1</span>
            </div>

            {todayWorkoutDay ? (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
                  Target muscles: {todayWorkoutDay.targetMuscleGroups.join(', ')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {todayWorkoutDay.exercises.slice(0, 3).map((ex, i) => (
                    <div
                      key={ex.id || i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{ex.exercise?.name || 'Exercise'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{ex.targetSets} sets × {ex.targetRepsMin}-{ex.targetRepsMax} reps</span>
                    </div>
                  ))}
                  {todayWorkoutDay.exercises.length > 3 && (
                    <small style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      +{todayWorkoutDay.exercises.length - 3} more exercises in session
                    </small>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}>
                <p>Generate your algorithmic split to start logging workouts.</p>
                <button className="btn btn-outline" onClick={onOpenGenerator}>
                  Generate Workout Routine
                </button>
              </div>
            )}
          </div>

          {todayWorkoutDay && (
            <button className="btn btn-primary btn-block btn-lg" onClick={onStartWorkout}>
              <Play size={20} fill="var(--text-inverse)" /> Start Workout Session
            </button>
          )}
        </div>

        {/* GURU JI COACH ADVISORY CARD */}
        <div
          className="card card-interactive"
          onClick={onOpenGuruJi}
          style={{
            cursor: 'pointer',
            borderColor: 'rgba(0, 240, 255, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <div style={{ padding: '8px', background: 'rgba(0, 240, 255, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--accent-secondary)' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <small style={{ color: 'var(--accent-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Guru Ji AI Coach</small>
                <h3>Daily Coach Insight</h3>
              </div>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', fontStyle: 'italic' }}>
              "Namaste! Workout shuru karne se pehle 5 minute dynamic stretching zaroor karein. Aaj consistency banaye rakhein!"
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>Ask Guru Ji a question</span>
            <ChevronRight size={18} color="var(--accent-secondary)" />
          </div>
        </div>
      </div>

      {/* QUICK METRICS ROW */}
      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        {/* Streak & Consistency */}
        <div
          className="card card-interactive"
          onClick={() => onNavigateTab('streaks')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'rgba(255, 77, 77, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-fire)' }}>
              <Flame size={28} />
            </div>
            <div>
              <small>Consistency</small>
              <h2>{streak.currentStreak} Days Streak</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Longest: {streak.longestStreak} days</span>
            </div>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>

        {/* Nutrition Targets */}
        <div
          className="card card-interactive"
          onClick={() => onNavigateTab('nutrition')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-success)' }}>
              <Utensils size={28} />
            </div>
            <div>
              <small>Daily Targets</small>
              <h2>{nutritionProfile ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target Protein: {nutritionProfile ? `${nutritionProfile.targetProteinG}g` : '140g'}
              </span>
            </div>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>
      </div>
    </div>
  );
};
