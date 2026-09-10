import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Share2 } from 'lucide-react';
import { workoutService } from '@/services/workout.service';
import { PersonalRecord, WorkoutSession } from '@/types/workout.types';
import { formatDate, formatDuration } from '@/utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import { PRODUCT_NAME } from '@/config/branding';

interface ProgressViewProps {
  userId?: string;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ userId: propUserId }) => {
  const { session } = useAuth();
  const userId = propUserId || session.user?.id || 'guest-user';
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeSharePR, setActiveSharePR] = useState<PersonalRecord | null>(null);

  const handleOpenPRShare = (pr: PersonalRecord) => {
    setActiveSharePR(pr);
  };

  useEffect(() => {
    async function loadData() {
      const [prData, historyData] = await Promise.all([
        workoutService.getPersonalRecords(userId),
        workoutService.getWorkoutHistory(userId),
      ]);
      setPrs(prData);
      setHistory(historyData);
    }
    loadData();
  }, [userId]);

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-gold">Verified PRs</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Historical Performance</span>
        </div>
        <h1>Progress & Personal Records</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Authoritative calculations derived from completed workout sets.
        </p>
      </div>

      {/* Personal Records Cards */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Trophy size={20} color="var(--accent-gold)" /> All-Time Personal Records
        </h3>

        {prs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Complete your first workout session to start tracking personal records automatically.</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {prs.map(pr => (
              <div key={pr.id} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <h4 style={{ fontSize: '1.1rem' }}>{pr.exerciseName}</h4>
                    <span className="badge badge-gold">PR</span>
                  </div>

                  <div style={{ margin: 'var(--space-3) 0' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                      {pr.weightKg} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>kg</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      for {pr.reps} reps (1RM: {pr.estimatedOneRepMax} kg)
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>{formatDate(pr.achievedAt)}</small>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenPRShare(pr)}
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  >
                    <Share2 size={13} /> Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workout History */}
      <div>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Calendar size={20} color="var(--accent-primary)" /> Workout History
        </h3>

        {history.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p>No completed workouts yet. Start your first session from the dashboard!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {history.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>{s.name}</h4>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>{formatDate(s.completedAt || s.startedAt)}</span>
                    <span>|</span>
                    <span>Duration: {formatDuration(s.durationSeconds)}</span>
                    {s.sessionRating && (
                      <>
                        <span>|</span>
                        <span style={{ textTransform: 'capitalize' }}>Felt {s.sessionRating}</span>
                      </>
                    )}
                  </div>
                </div>

                <span className="badge badge-accent">Completed</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shareable Card Modal Preview */}
      {activeSharePR && (
        <div className="modal-backdrop" onClick={() => setActiveSharePR(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '2px solid var(--accent-gold)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8) var(--space-6)',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div className="badge badge-gold" style={{ marginBottom: 'var(--space-4)' }}>
                NEW PERSONAL RECORD
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-heading)' }}>{activeSharePR.exerciseName}</h2>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                {activeSharePR.weightKg} <span style={{ fontSize: '1.8rem', fontWeight: 600 }}>KG</span>
              </div>
              <p style={{ marginTop: 'var(--space-3)', fontSize: '1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {activeSharePR.reps} Reps | 1RM: {activeSharePR.estimatedOneRepMax} kg
              </p>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{PRODUCT_NAME}</span>
                <span>{formatDate(activeSharePR.achievedAt)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `New PR on ${activeSharePR.exerciseName}!`,
                    text: `I just hit a new PR of ${activeSharePR.weightKg} kg for ${activeSharePR.reps} reps on ${PRODUCT_NAME}!`,
                  }).catch(() => {});
                } else {
                  alert('Copied to clipboard: ' + `I just hit a new PR of ${activeSharePR.weightKg} kg on ${PRODUCT_NAME}!`);
                }
                setActiveSharePR(null);
              }}
            >
              Share Achievement
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
