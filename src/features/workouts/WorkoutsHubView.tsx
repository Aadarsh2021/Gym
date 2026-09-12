import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Play, Clock, History } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workout.service';
import { streakService } from '@/services/streak.service';
import { WorkoutPlan, WorkoutPlanDay, WorkoutSession } from '@/types/workout.types';
import { getDayScheduledDays, getTodaysScheduledWorkout } from '@/domain/scheduled-workout';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface WorkoutsHubViewProps {
  onStartWorkoutWithDay: (day: WorkoutPlanDay) => void;
}

export const WorkoutsHubView: React.FC<WorkoutsHubViewProps> = ({ onStartWorkoutWithDay }) => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';

  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [restDayLogged, setRestDayLogged] = useState(false);

  const scheduleResult = useMemo(() => {
    if (!activePlan) return null;
    return getTodaysScheduledWorkout({
      activePlan,
      currentDate: new Date(),
      completedSessions: history,
    });
  }, [activePlan, history]);

  const handleMarkRestDay = async () => {
    await streakService.logRestDay(userId);
    setRestDayLogged(true);
  };

  useEffect(() => {
    let isMounted = true;
    const loadPlanAndHistory = async () => {
      try {
        const [plan, sessions] = await Promise.all([
          workoutService.getActivePlan(userId),
          workoutService.getWorkoutHistory(userId, 10),
        ]);
        if (isMounted) {
          setActivePlan(plan);
          setHistory(sessions);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadPlanAndHistory();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading training routine...</p>
      </div>
    );
  }

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <span className="badge badge-accent" style={{ marginBottom: 'var(--space-1)' }}>Workout Hub</span>
          <h1>Your Training Plan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Execute scheduled training days or launch individual workouts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/plan/build" className="btn btn-outline btn-sm">
            Rebuild Split
          </Link>
        </div>
      </div>

      {/* Missed Session Recovery Notification */}
      {scheduleResult?.missedPreviousWorkout && !restDayLogged && (
        <div
          className="card"
          style={{
            padding: 'var(--space-4)',
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-medium)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Missed Session</span>
              <strong style={{ color: 'var(--text-primary)' }}>{scheduleResult.missedPreviousWorkout.name}</strong>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              You can make up this session today, or log an active recovery day to keep your streak intact.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onStartWorkoutWithDay(scheduleResult.missedPreviousWorkout!)}
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
        <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3)', background: 'var(--color-success-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: '0.85rem' }}>
          ✓ Rest day logged. Your training consistency streak is preserved!
        </div>
      )}

      {/* Active Plan Content */}
      {activePlan && activePlan.days && activePlan.days.length > 0 ? (
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <div className="card card-elevated" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <h3>{activePlan.name}</h3>
              <span className="badge badge-accent">{activePlan.splitType}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              {activePlan.description || 'Custom workout split'}
            </p>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-6)' }}>
            {activePlan.days.map((day, idx) => {
              const scheduledDOWs = getDayScheduledDays(day, activePlan.days.length, idx);
              const dowNames = scheduledDOWs.map(d => DAY_NAMES[d]).join(', ');

              return (
                <div key={day.id || idx} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                      <span className="badge badge-accent">Day {day.dayNumber}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{dowNames}</span>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{day.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                      {day.targetMuscleGroups.join(', ')}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                      {day.exercises.map((ex, exIdx) => (
                        <div
                          key={ex.id || exIdx}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{ex.exercise?.name || 'Exercise'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{ex.targetSets} × {ex.targetRepsMin}-{ex.targetRepsMax}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => onStartWorkoutWithDay(day)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Play size={16} fill="var(--text-inverse)" /> Start {day.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-6)', marginBottom: 'var(--space-10)' }}>
          <Dumbbell size={36} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-3)' }} />
          <h3>No Active Training Plan</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto var(--space-6)' }}>
            You haven't generated or activated a training split yet. Create a science-backed plan matched to your equipment.
          </p>
          <Link to="/plan/build" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
            Build Your Workout Plan →
          </Link>
        </div>
      )}

      {/* Workout History Section */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <History size={20} color="var(--accent-primary)" /> Completed Session History
        </h3>

        {history.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No completed workout sessions logged yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {history.map(session => (
              <div
                key={session.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{session.name}</div>
                  <small style={{ color: 'var(--text-muted)' }}>
                    {session.completedAt ? new Date(session.completedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Recently completed'}
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} /> {Math.round((session.durationSeconds || 0) / 60)} min
                  </div>
                  <span className="badge badge-accent">Completed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
