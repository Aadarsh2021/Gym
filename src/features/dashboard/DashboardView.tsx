import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Flame,
  Utensils,
  ChevronRight,
  Zap,
  CheckCircle2,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { WorkoutPlan, WorkoutSession, WorkoutPlanDay } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile, DailyMacroTotals } from '@/types/nutrition.types';
import { AuthSession } from '@/services/auth.service';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { streakService } from '@/services/streak.service';
import { PRODUCT_NAME } from '@/config/branding';

interface DashboardViewProps {
  activePlan: WorkoutPlan | null;
  streak: UserStreak;
  nutritionProfile: NutritionProfile | null;
  dailyTotals?: DailyMacroTotals;
  recentSessions?: WorkoutSession[];
  coins?: number;
  session?: AuthSession;
  onStartWorkout: (day?: WorkoutPlanDay) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activePlan,
  streak,
  nutritionProfile,
  dailyTotals,
  recentSessions = [],
  coins = 0,
  session,
  onStartWorkout,
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
  const [restDayLogged, setRestDayLogged] = useState(false);

  const handleMarkRestDay = async () => {
    if (!session?.user?.id) return;
    await streakService.logRestDay(session.user.id);
    setRestDayLogged(true);
  };

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
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
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
                background: 'rgba(127, 166, 107, 0.14)',
                color: 'var(--color-success)',
                border: '1px solid rgba(127, 166, 107, 0.32)',
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
                  backgroundColor: 'var(--color-success)',
                  boxShadow: '0 0 8px rgba(127, 166, 107, 0.6)',
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
            borderColor: 'var(--border-subtle)',
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
                  ? 'var(--color-info)'
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
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
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
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
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
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
            }}
          >
            <Flame size={22} fill="var(--accent-primary)" />
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
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.totalCalories} / ${nutritionProfile?.targetCalories || 2200} kcal`
                : nutritionProfile ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.totalProteinG}g / ${nutritionProfile?.targetProteinG || 140}g Protein →`
                : nutritionProfile ? `${nutritionProfile.targetProteinG}g Protein Goal →` : '140g Protein Goal →'}
            </span>
          </div>
        </Link>
      </div>

      {/* Main Grid: Mission + Coach */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* TODAY'S MISSION CARD (Modern Graphite Elevated) */}
        <div
          className="card card-elevated"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--border-medium)',
            boxShadow: 'var(--shadow-md)',
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
                        ? 'var(--color-info)'
                        : 'var(--accent-primary)',
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
                {scheduleResult.missedPreviousWorkout && !restDayLogged && (
                  <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-2)', lineHeight: 1.4 }}>
                      Missed previous session ({scheduleResult.missedPreviousWorkout.name})? You can make it up today or log it as an active recovery day to keep your streak intact.
                    </small>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onStartWorkout(scheduleResult.missedPreviousWorkout!)}
                      >
                        Make Up Session
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleMarkRestDay}
                      >
                        Mark as Rest Day
                      </button>
                    </div>
                  </div>
                )}

                {restDayLogged && (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-success-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: '0.82rem' }}>
                    ✓ Rest day logged. Consistency streak preserved!
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

        {/* DAILY NUTRITION TARGETS CARD (3D Glass) */}
        <Link
          to="/app/nutrition"
          className="card card-interactive"
          style={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(145deg, rgba(16, 24, 40, 0.85) 0%, rgba(10, 14, 26, 0.92) 100%)',
            borderColor: 'var(--border-medium)',
            boxShadow: '0 18px 45px -8px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '10px',
                    background: 'var(--accent-primary-muted)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-primary)',
                    boxShadow: '0 0 16px var(--accent-primary-glow)',
                  }}
                >
                  <Utensils size={22} />
                </div>
                <div>
                  <small style={{ color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                    Daily Nutrition Targets
                  </small>
                  <h3 style={{ fontSize: '1.25rem', margin: '2px 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>Macro & Calorie Fuel</h3>
                </div>
              </div>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                Active Target
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', margin: 'var(--space-4) 0' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calories (Consumed / Target)</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {dailyTotals ? dailyTotals.totalCalories : 0}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {nutritionProfile ? nutritionProfile.targetCalories : 2200}
                  </span>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>kcal</small>
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protein (Consumed / Target)</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {dailyTotals ? dailyTotals.totalProteinG : 0}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {nutritionProfile ? nutritionProfile.targetProteinG : 140}
                  </span>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>g</small>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 var(--space-2)' }}>
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.entriesCount} meal item${dailyTotals.entriesCount > 1 ? 's' : ''} logged today. Target remaining: ${Math.max(0, (nutritionProfile?.targetCalories || 2200) - dailyTotals.totalCalories)} kcal and ${Math.max(0, Math.round(((nutritionProfile?.targetProteinG || 140) - dailyTotals.totalProteinG) * 10) / 10)}g protein.`
                : 'Hit your daily protein and calorie targets to fuel muscular recovery, support hypertrophy, and maintain energy levels.'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.86rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              View Nutrition Plan & Food Diary →
            </span>
            <ChevronRight size={18} color="var(--accent-primary)" />
          </div>
        </Link>
      </div>
    </div>
  );
};
