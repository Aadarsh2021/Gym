import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Flame,
  Utensils,
  Sparkles,
  ChevronRight,
  Zap,
  CheckCircle2,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { WorkoutPlan, WorkoutSession, WorkoutPlanDay } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile } from '@/types/nutrition.types';
import { AuthSession } from '@/services/auth.service';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { PRODUCT_NAME } from '@/config/branding';

interface DashboardViewProps {
  activePlan: WorkoutPlan | null;
  streak: UserStreak;
  nutritionProfile: NutritionProfile | null;
  recentSessions?: WorkoutSession[];
  coins?: number;
  session?: AuthSession;
  onStartWorkout: (day?: WorkoutPlanDay) => void;
  onOpenGuruJi: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activePlan,
  streak,
  nutritionProfile,
  recentSessions = [],
  coins = 0,
  session,
  onStartWorkout,
  onOpenGuruJi,
}) => {
  // Pure deterministic scheduler calculation
  const scheduleResult = useMemo(() => {
    return getTodaysScheduledWorkout({
      activePlan,
      currentDate: new Date(),
      completedSessions: recentSessions,
    });
  }, [activePlan, recentSessions]);

  const scheduledDay = scheduleResult.scheduledDay;

  // User details & Greeting
  const displayName =
    session?.profile?.displayName ||
    session?.user?.email?.split('@')[0] ||
    'Athlete';
  const firstName = displayName.split(' ')[0];

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 17
      ? 'Good afternoon'
      : currentHour < 21
      ? 'Good evening'
      : 'Good night';

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* Personalized Welcome Banner */}
      <div className="dashboard-welcome-banner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="badge badge-accent" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              {PRODUCT_NAME} PRO
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
              ● Supabase Live
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </span>
        </div>

        <h1 style={{ fontSize: '1.85rem', margin: '0 0 var(--space-2)' }}>
          {timeGreeting}, {firstName}! ⚡
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', maxWidth: '720px', lineHeight: 1.6 }}>
          {scheduleResult.status === 'completed_today'
            ? 'Shaabash! Today’s session is logged. Prioritize hydration, post-workout protein, and restorative sleep.'
            : scheduleResult.status === 'rest_day'
            ? 'Active recovery window today. Your muscles rebuild and grow during rest—stay hydrated and meet your nutrition target.'
            : scheduleResult.status === 'no_plan'
            ? 'Welcome to your athlete command center. Set up your personalized training plan to unlock your scheduled daily routine.'
            : `Today’s objective is ${scheduledDay?.name || 'Workout Session'}. Execute every set with strict form and disciplined intensity.`}
        </p>
      </div>

      {/* Athlete Status & Quick Glance Strip (4 Non-Duplicative Metric Cards) */}
      <div className="athlete-strip-grid">
        {/* Card 1: Today's Mission Status */}
        <div
          className="card card-interactive"
          onClick={() => {
            if (scheduledDay && scheduleResult.status === 'scheduled') {
              onStartWorkout(scheduledDay);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            cursor: scheduledDay && scheduleResult.status === 'scheduled' ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              padding: '9px',
              background:
                scheduleResult.status === 'completed_today'
                  ? 'var(--color-success-muted)'
                  : scheduleResult.status === 'rest_day'
                  ? 'var(--accent-indigo-muted)'
                  : 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color:
                scheduleResult.status === 'completed_today'
                  ? 'var(--color-success)'
                  : scheduleResult.status === 'rest_day'
                  ? '#8FA8C7'
                  : 'var(--accent-primary)',
            }}
          >
            {scheduleResult.status === 'completed_today' ? (
              <CheckCircle2 size={20} />
            ) : scheduleResult.status === 'rest_day' ? (
              <Moon size={20} />
            ) : (
              <Zap size={20} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Today's Status
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest Day' : 'Setup Plan'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
              {scheduleResult.status === 'completed_today' ? 'Done ✓' : scheduleResult.status === 'rest_day' ? 'Recovery' : 'Start →'}
            </span>
          </div>
        </div>

        {/* Card 2: Active Plan */}
        <Link
          to="/app/workouts"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div style={{ padding: '9px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)' }}>
            <Zap size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Routine
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activePlan ? activePlan.name : 'No Active Plan'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
              {activePlan ? `${activePlan.days.length} Days/Wk →` : 'Build Plan →'}
            </span>
          </div>
        </Link>

        {/* Card 3: Consistency Streak */}
        <Link
          to="/app/progress"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div style={{ padding: '9px', background: 'var(--accent-gold-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-gold)' }}>
            <Flame size={20} fill="var(--accent-gold)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Consistency
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {streak.currentStreak} Days Streak
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {coins > 0 ? `${coins} Coins • ` : ''}Longest: {streak.longestStreak}d →
            </span>
          </div>
        </Link>

        {/* Card 4: Daily Energy & Nutrition */}
        <Link
          to="/app/nutrition"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div style={{ padding: '9px', background: 'var(--color-success-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)' }}>
            <Utensils size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Daily Energy
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {nutritionProfile ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>
              {nutritionProfile ? `${nutritionProfile.targetProteinG}g Protein →` : '140g Protein →'}
            </span>
          </div>
        </Link>
      </div>

      {/* Main Grid: Mission + Coach */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* TODAY'S MISSION CARD (Bolder, focal element) */}
        <div className="card card-elevated" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: scheduleResult.status === 'scheduled' ? 'var(--border-medium)' : 'var(--border-subtle)' }}>
          <div>
            {/* Header of Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '10px',
                    background:
                      scheduleResult.status === 'completed_today'
                        ? 'var(--color-success-muted)'
                        : scheduleResult.status === 'rest_day'
                        ? 'var(--accent-indigo-muted)'
                        : 'var(--accent-primary-muted)',
                    borderRadius: 'var(--radius-sm)',
                    color:
                      scheduleResult.status === 'completed_today'
                        ? 'var(--color-success)'
                        : scheduleResult.status === 'rest_day'
                        ? '#8FA8C7'
                        : 'var(--accent-primary)',
                  }}
                >
                  {scheduleResult.status === 'completed_today' ? (
                    <CheckCircle2 size={22} />
                  ) : scheduleResult.status === 'rest_day' ? (
                    <Moon size={22} />
                  ) : (
                    <Zap size={22} />
                  )}
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {scheduleResult.status === 'completed_today'
                      ? 'Session Complete'
                      : scheduleResult.status === 'rest_day'
                      ? 'Recovery Window'
                      : scheduleResult.status === 'no_plan'
                      ? 'Setup Required'
                      : "Today's Routine"}
                  </small>
                  <h3 style={{ fontSize: '1.25rem', margin: '2px 0 0' }}>
                    {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest & Recovery Day' : 'Build Your Training Plan'}
                  </h3>
                </div>
              </div>

              {scheduledDay && (
                <span className="badge badge-accent">Day {scheduledDay.dayNumber}</span>
              )}
            </div>

            {/* Content Based on Scheduler Status */}
            {scheduleResult.status === 'no_plan' ? (
              /* NO PLAN STATE */
              <div style={{ padding: 'var(--space-4) 0 var(--space-6)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.95rem' }}>
                  You don't have an active training plan yet. Generate a personalized routine matched to your equipment and schedule.
                </p>
                <Link to="/plan/build" className="btn btn-primary btn-block btn-lg" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Create My Plan <ArrowRight size={18} />
                </Link>
              </div>
            ) : scheduleResult.status === 'completed_today' ? (
              /* COMPLETED TODAY STATE */
              <div style={{ padding: 'var(--space-2) 0 var(--space-4)' }}>
                <p style={{ fontSize: '0.92rem', color: 'var(--accent-success)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> Great work! Today's session was successfully logged.
                </p>
                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next scheduled session: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {scheduleResult.nextScheduledWorkout.day.name} ({scheduleResult.nextScheduledWorkout.dayOfWeekName})
                    </strong>
                  </div>
                )}
              </div>
            ) : scheduleResult.status === 'rest_day' ? (
              /* REST DAY STATE */
              <div style={{ padding: 'var(--space-2) 0 var(--space-4)' }}>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  Muscle protein synthesis and neurological recovery happen while resting. Prioritize hydration and hit your protein target today.
                </p>

                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next training day: </span>
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {scheduleResult.nextScheduledWorkout.day.name} ({scheduleResult.nextScheduledWorkout.dayOfWeekName})
                    </strong>
                  </div>
                )}

                {/* Off-schedule recovery / catchup */}
                {scheduleResult.missedPreviousWorkout && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                      Missed previous session ({scheduleResult.missedPreviousWorkout.name})?
                    </small>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onStartWorkout(scheduleResult.missedPreviousWorkout!)}
                    >
                      Make Up Missed Session
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* SCHEDULED TODAY STATE */
              scheduledDay && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    Target muscle groups: <strong style={{ color: 'var(--text-primary)' }}>{scheduledDay.targetMuscleGroups.join(', ')}</strong>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {scheduledDay.exercises.slice(0, 3).map((ex, i) => (
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
                        <span style={{ fontWeight: 500 }}>{ex.exercise?.name || 'Compound Movement'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {ex.targetSets} sets × {ex.targetRepsMin}-{ex.targetRepsMax}
                        </span>
                      </div>
                    ))}
                    {scheduledDay.exercises.length > 3 && (
                      <small style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        +{scheduledDay.exercises.length - 3} more exercises in today's split
                      </small>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Action Button */}
          {scheduleResult.status === 'scheduled' && scheduledDay && (
            <button className="btn btn-primary btn-block btn-lg" onClick={() => onStartWorkout(scheduledDay)}>
              <Play size={20} fill="var(--text-inverse)" /> Start Today's Workout
            </button>
          )}

          {scheduleResult.status === 'completed_today' && (
            <Link to="/app/progress" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
              View Workout Summary & PRs
            </Link>
          )}
        </div>

        {/* GURU JI COACH ADVISORY CARD */}
        <div
          className="card card-interactive"
          onClick={onOpenGuruJi}
          style={{
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <div style={{ padding: '8px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <small style={{ color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Guru Ji Coaching
                </small>
                <h3 style={{ fontSize: '1.2rem' }}>Daily Training Insight</h3>
              </div>
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', fontStyle: 'italic' }}>
              {scheduleResult.status === 'rest_day'
                ? '"Rest day par hydration aur quality sleep par dhyan dein. Muscles gym me nahi, recovery ke dauraan banti hain."'
                : scheduleResult.status === 'completed_today'
                ? '"Shaabash! Aaj ka session complete hua. Agle 2 ghante me protein-rich meal lena mat bhooliyega."'
                : '"Namaste! Har set me form strict rakhein. Last 2 reps challenging hone chahiye, lekin form break nahi honi chahiye!"'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>Ask Guru Ji for form cues</span>
            <ChevronRight size={18} color="var(--accent-secondary)" />
          </div>
        </div>
      </div>
    </div>
  );
};
