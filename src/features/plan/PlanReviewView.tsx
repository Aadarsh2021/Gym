import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, AlertCircle, Eye, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loadDraftPlan, clearDraftPlan } from '@/utils/storage';
import { supabase } from '@/lib/supabase';
import { workoutService } from '@/services/workout.service';
import { GeneratedPlan } from '@/domain/workout-generator';
import { Exercise } from '@/types/workout.types';
import { ExerciseVisualGuide } from '@/components/exercise/ExerciseVisualGuide';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PlanReviewView: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [draftPlan, setDraftPlan] = useState<GeneratedPlan | null>(null);
  const [activating, setActivating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExerciseForGuide, setSelectedExerciseForGuide] = useState<Exercise | null>(null);

  useEffect(() => {
    // Safe across refreshes: load draft plan from session storage
    const loaded = loadDraftPlan();
    if (loaded) {
      setDraftPlan(loaded);
    }
  }, []);

  const handleActivate = async () => {
    if (!draftPlan) return;
    setActivating(true);
    setError(null);

    try {
      // Get the freshest session user ID in case of recent OAuth redirect
      const { data: authData } = await supabase.auth.getSession();
      const activeUserId = authData?.session?.user?.id || session.user?.id;

      if (!activeUserId) {
        setError('Please sign in to activate your training plan.');
        setActivating(false);
        navigate('/signin', { state: { from: { pathname: '/plan/review' } } });
        return;
      }

      // Authoritative Supabase persistence happens ONLY upon explicit activation
      const saved = await workoutService.saveGeneratedPlan(activeUserId, draftPlan);
      if (saved) {
        clearDraftPlan();
        navigate('/app', { replace: true });
      } else {
        setError('Error: Could not save plan. Please retry.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error activating plan';
      setError(msg);
    } finally {
      setActivating(false);
    }
  };

  if (!draftPlan) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-12) var(--space-4)', maxWidth: '560px', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 77, 77, 0.15)', borderRadius: 'var(--radius-md)', display: 'inline-flex', color: 'var(--accent-fire)', marginBottom: 'var(--space-3)' }}>
            <AlertCircle size={24} />
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>No Plan Draft Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', fontSize: '0.92rem' }}>
            There is no pending plan review in this session. Configure your parameters to generate a fresh routine.
          </p>
          <Link to="/plan/build" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Go to Plan Builder →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-accent">Draft Preview</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Not yet activated</span>
        </div>
        <h1>Review Your Training Plan</h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
          Inspect every scheduled training day, exercise selection, and rep prescription before activating.
        </p>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'rgba(255, 77, 77, 0.15)',
            border: '1px solid var(--accent-fire)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-fire)',
            fontSize: '0.85rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Plan Summary Card */}
      <div className="card card-elevated" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <h2>{draftPlan.name}</h2>
          <span className="badge badge-accent">{draftPlan.splitType}</span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
          {draftPlan.description}
        </p>
      </div>

      {/* Day-by-Day Inspection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {draftPlan.days.map((day, idx) => {
          const scheduledDOWs = day.scheduledDaysOfWeek || [];
          const daysText = scheduledDOWs.length > 0
            ? scheduledDOWs.map(d => DAY_NAMES[d]).join(', ')
            : `Day ${day.dayNumber}`;

          return (
            <div key={day.id || idx} className="card" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span className="badge badge-accent">Day {day.dayNumber}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{daysText}</span>
                  </div>
                  <h3 style={{ fontSize: '1.2rem' }}>{day.name}</h3>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  Target: {day.targetMuscleGroups.join(', ')}
                </small>
              </div>

              {/* Exercise table/list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                {day.exercises.map((ex, exIdx) => (
                  <div
                    key={ex.id || exIdx}
                    onClick={() => ex.exercise && setSelectedExerciseForGuide(ex.exercise)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.9rem',
                      cursor: ex.exercise ? 'pointer' : 'default',
                      transition: 'border-color 0.15s ease',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (ex.exercise) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseLeave={e => {
                      if (ex.exercise) (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{ex.exercise?.name || 'Movement'}</span>
                        {ex.exercise && (
                          <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Eye size={11} /> Guide
                          </span>
                        )}
                      </div>
                      <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {ex.exercise?.primaryMuscle} • {ex.isCore ? 'Compound Core' : 'Accessory'}
                      </small>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {ex.targetSets} sets × {ex.targetRepsMin}-{ex.targetRepsMax} reps
                      </span>
                      <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {ex.restSeconds}s rest interval
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activation Action Bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-6)',
        }}
      >
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/plan/build')}
          disabled={activating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Reconfigure Split
        </button>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleActivate}
          disabled={activating}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {activating ? 'Activating Plan...' : 'Activate This Plan'} <Check size={18} />
        </button>
      </div>

      {/* Exercise Visual Guide Modal */}
      {selectedExerciseForGuide && (
        <div className="modal-backdrop" onClick={() => setSelectedExerciseForGuide(null)}>
          <div
            className="modal-content animate-fade-in"
            style={{ maxWidth: '640px', padding: 0, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="var(--accent-primary)" />
                <strong style={{ fontSize: '0.95rem' }}>Visual Exercise Guide</strong>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setSelectedExerciseForGuide(null)}
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%' }}
                aria-label="Close guide modal"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-4)', maxHeight: '80vh', overflowY: 'auto' }}>
              <ExerciseVisualGuide
                exercise={selectedExerciseForGuide}
                variant="full"
                showCues={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
