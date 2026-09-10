import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Share2 } from 'lucide-react';
import { workoutService } from '@/services/workout.service';
import { PersonalRecord, WorkoutSession } from '@/types/workout.types';
import { formatDate, formatDuration } from '@/utils/formatters';

interface ProgressViewProps {
  userId: string;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ userId }) => {
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [activeSharePR, setActiveSharePR] = useState<PersonalRecord | null>(null);

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
        <span className="badge badge-fire" style={{ marginBottom: 'var(--space-1)' }}>Authoritative PRs</span>
        <h1>Progress & Personal Records</h1>
        <p>Verified from completed workout sessions. Never fabricated.</p>
      </div>

      {/* Personal Records Cards */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Trophy size={20} color="var(--accent-primary)" /> All-Time Personal Records
        </h3>

        {prs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p>Complete your first workout session to start tracking personal records automatically.</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {prs.map(pr => (
              <div key={pr.id} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <h4 style={{ fontSize: '1.1rem' }}>{pr.exerciseName}</h4>
                    <span className="badge badge-fire">PR</span>
                  </div>

                  <div style={{ margin: 'var(--space-3) 0' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent-primary)' }}>
                      {pr.weightKg} kg
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>
                      for {pr.reps} reps (Estimated 1RM: {pr.estimatedOneRepMax} kg)
                    </small>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <small style={{ color: 'var(--text-muted)' }}>{formatDate(pr.achievedAt)}</small>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveSharePR(pr)}
                    style={{ padding: '4px 8px' }}
                  >
                    <Share2 size={14} /> Share
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
          <Calendar size={20} color="var(--accent-secondary)" /> Workout History
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
                    <span>•</span>
                    <span>Duration: {formatDuration(s.durationSeconds)}</span>
                    {s.sessionRating && (
                      <>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>Felt {s.sessionRating}</span>
                      </>
                    )}
                  </div>
                </div>

                <span className="badge badge-lime">Completed</span>
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
                background: 'linear-gradient(145deg, #101522 0%, #151C2C 100%)',
                border: '2px solid var(--accent-primary)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8) var(--space-6)',
                boxShadow: 'var(--glow-primary)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div className="badge badge-fire" style={{ marginBottom: 'var(--space-4)' }}>
                NEW PERSONAL RECORD
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)' }}>{activeSharePR.exerciseName}</h2>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>
                {activeSharePR.weightKg} KG
              </div>
              <p style={{ marginTop: 'var(--space-2)', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                {activeSharePR.reps} Clean Reps • 1RM: {activeSharePR.estimatedOneRepMax} kg
              </p>
              <div style={{ borderTop: '1px solid var(--border-medium)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>FITNESS.AI</span>
                <span>{formatDate(activeSharePR.achievedAt)}</span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `New PR on ${activeSharePR.exerciseName}!`,
                    text: `I just hit a new PR of ${activeSharePR.weightKg} kg for ${activeSharePR.reps} reps on Fitness AI!`,
                  }).catch(() => {});
                } else {
                  alert('Copied to clipboard: ' + `I just hit a new PR of ${activeSharePR.weightKg} kg on Fitness AI!`);
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
