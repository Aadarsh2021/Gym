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
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="badge badge-accent" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              {PRODUCT_NAME} PRO
            </span>
            <span
              className="badge"
              style={{
                fontSize: '0.74rem',
                background: 'rgba(0, 242, 157, 0.12)',
                color: '#00F29D',
                border: '1px solid rgba(0, 242, 157, 0.32)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#00F29D',
                  boxShadow: '0 0 8px #00F29D',
                  display: 'inline-block',
                }}
              />
              Supabase Live
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </span>
        </div>

        <h1
          style={{
            fontSize: '2.1rem',
            fontWeight: 800,
            margin: '0 0 var(--space-2)',
            background: 'linear-gradient(135deg, #FFFFFF 50%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
          }}
        >
          {timeGreeting}, {firstName}! <span style={{ WebkitTextFillColor: 'initial' }}>⚡</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.98rem', maxWidth: '720px', lineHeight: 1.6 }}>
          {scheduleResult.status === 'completed_today'
            ? 'Shaabash! Today’s session is logged. Prioritize hydration, post-workout protein, and restorative sleep.'
            : scheduleResult.status === 'rest_day'
            ? 'Active recovery window today. Your muscles rebuild and grow during rest—stay hydrated and meet your nutrition target.'
            : scheduleResult.status === 'no_plan'
            ? 'Welcome to your athlete command center. Set up your personalized training plan to unlock your scheduled daily routine.'
            : `Today’s objective is ${scheduledDay?.name || 'Workout Session'}. Execute every set with strict form and disciplined intensity.`}
        </p>
      </div>

      {/* Athlete Status & Quick Glance Strip (4 3D Glass Cards) */}
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
            borderColor: scheduleResult.status === 'scheduled' ? 'rgba(0, 242, 157, 0.3)' : undefined,
          }}
        >
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
                  ? '#818CF8'
                  : 'var(--accent-primary)',
              boxShadow:
                scheduleResult.status === 'scheduled'
                  ? '0 0 16px rgba(0, 242, 157, 0.25)'
                  : undefined,
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Today's Mission
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest Day' : 'Setup Plan'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {scheduleResult.status === 'completed_today' ? 'Done ✓' : scheduleResult.status === 'rest_day' ? 'Recovery' : 'Start Session →'}
            </span>
          </div>
        </div>

        {/* Card 2: Active Routine */}
        <Link
          to="/app/workouts"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              padding: '10px',
              background: 'var(--accent-cyan-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-cyan)',
              boxShadow: '0 0 14px rgba(6, 182, 212, 0.2)',
            }}
          >
            <Zap size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Split
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activePlan ? activePlan.name : 'No Active Plan'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              {activePlan ? `${activePlan.days.length} Days / Week →` : 'Build Plan →'}
            </span>
          </div>
        </Link>

        {/* Card 3: Consistency Streak */}
        <Link
          to="/app/progress"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              padding: '10px',
              background: 'var(--accent-gold-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-gold)',
              boxShadow: '0 0 16px rgba(255, 184, 0, 0.25)',
            }}
          >
            <Flame size={22} fill="var(--accent-gold)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Streak Record
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {streak.currentStreak} Days Active
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
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
          <div
            style={{
              padding: '10px',
              background: 'var(--color-success-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-success)',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.22)',
            }}
          >
            <Utensils size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Daily Fuel
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {nutritionProfile ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
              {nutritionProfile ? `${nutritionProfile.targetProteinG}g Protein →` : '140g Protein →'}
            </span>
          </div>
        </Link>
      </div>

      {/* Main Grid: Mission + Coach */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* TODAY'S MISSION CARD (3D Elevated) */}
        <div
          className="card card-elevated"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: scheduleResult.status === 'scheduled' ? 'rgba(0, 242, 157, 0.4)' : 'var(--border-medium)',
            boxShadow:
              scheduleResult.status === 'scheduled'
                ? '0 20px 48px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 157, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18)'
                : undefined,
          }}
        >
          <div>
            {/* Header of Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '11px',
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
                        ? '#818CF8'
                        : 'var(--accent-primary)',
                    boxShadow:
                      scheduleResult.status === 'scheduled'
                        ? '0 0 16px rgba(0, 242, 157, 0.28)'
                        : undefined,
                  }}
                >
                  {scheduleResult.status === 'completed_today' ? (
                    <CheckCircle2 size={24} />
                  ) : scheduleResult.status === 'rest_day' ? (
                    <Moon size={24} />
                  ) : (
                    <Zap size={24} />
                  )}
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    {scheduleResult.status === 'completed_today'
                      ? 'Session Complete'
                      : scheduleResult.status === 'rest_day'
                      ? 'Recovery Window'
                      : scheduleResult.status === 'no_plan'
                      ? 'Setup Required'
                      : "Today's Routine"}
                  </small>
                  <h3 style={{ fontSize: '1.35rem', margin: '2px 0 0', fontWeight: 700 }}>
                    {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest & Recovery Day' : 'Build Your Training Plan'}
                  </h3>
                </div>
              </div>

              {scheduledDay && (
                <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                  Day {scheduledDay.dayNumber}
                </span>
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
                <p style={{ fontSize: '0.94rem', color: 'var(--color-success)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <CheckCircle2 size={18} /> Great work! Today's session was successfully logged.
                </p>
                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
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
                <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  Muscle protein synthesis and neurological recovery happen while resting. Prioritize hydration and hit your protein target today.
                </p>

                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)', fontSize: '0.88rem' }}>
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
                  <p style={{ fontSize: '0.92rem', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    Target muscle groups: <strong style={{ color: 'var(--text-primary)' }}>{scheduledDay.targetMuscleGroups.join(', ')}</strong>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {scheduledDay.exercises.slice(0, 3).map((ex, i) => (
                      <div
                        key={ex.id || i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.88rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.exercise?.name || 'Compound Movement'}</span>
                        <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'var(--accent-primary-muted)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                          {ex.targetSets} sets × {ex.targetRepsMin}-{ex.targetRepsMax}
                        </span>
                      </div>
                    ))}
                    {scheduledDay.exercises.length > 3 && (
                      <small style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4px' }}>
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
              <Play size={20} fill="var(--accent-primary-text)" /> Start Today's Workout
            </button>
          )}

          {scheduleResult.status === 'completed_today' && (
            <Link to="/app/progress" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
              View Workout Summary & PRs
            </Link>
          )}
        </div>

        {/* GURU JI COACH ADVISORY CARD (Cosmic Violet 3D Glass) */}
        <div
          className="card card-interactive"
          onClick={onOpenGuruJi}
          style={{
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(145deg, rgba(28, 22, 58, 0.78) 0%, rgba(13, 12, 28, 0.88) 100%)',
            borderColor: 'rgba(139, 92, 246, 0.35)',
            boxShadow: '0 18px 45px -8px rgba(0, 0, 0, 0.75), 0 0 28px rgba(139, 92, 246, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '10px',
                    background: 'rgba(139, 92, 246, 0.18)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#A78BFA',
                    boxShadow: '0 0 18px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  <Sparkles size={24} />
                </div>
                <div>
                  <small style={{ color: '#A78BFA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                    AI COACH GURU JI
                  </small>
                  <h3 style={{ fontSize: '1.3rem', margin: '2px 0 0', fontWeight: 700 }}>Daily Training Insight</h3>
                </div>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                Online
              </span>
            </div>

            <p style={{ fontSize: '0.98rem', lineHeight: 1.65, color: '#E2E8F0', fontStyle: 'italic', margin: 'var(--space-3) 0 var(--space-4)' }}>
              {scheduleResult.status === 'rest_day'
                ? '"Rest day par hydration aur quality sleep par dhyan dein. Muscles gym me nahi, recovery ke dauraan banti hain."'
                : scheduleResult.status === 'completed_today'
                ? '"Shaabash! Aaj ka session complete hua. Agle 2 ghante me protein-rich meal lena mat bhooliyega."'
                : '"Namaste! Har set me form strict rakhein. Last 2 reps challenging hone chahiye, lekin form break nahi honi chahiye!"'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(139, 92, 246, 0.25)',
              paddingTop: 'var(--space-3)',
            }}
          >
            <span style={{ fontSize: '0.88rem', color: '#A78BFA', fontWeight: 600 }}>
              Ask Guru Ji for form cues & diet advice →
            </span>
            <ChevronRight size={20} color="#A78BFA" />
          </div>
        </div>
      </div>
    </div>
  );
};
