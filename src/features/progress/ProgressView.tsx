import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Share2, TrendingUp, BarChart3, Scale, Layers, History, Filter } from 'lucide-react';
import { workoutService } from '@/services/workout.service';
import { progressService, ProgressEntry } from '@/services/progress.service';
import { PersonalRecord, WorkoutSession, PRHistoryEvent } from '@/types/workout.types';
import { formatDate, formatDuration } from '@/utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import { PRODUCT_NAME } from '@/config/branding';
import { StrengthProgressChart } from '@/components/charts/StrengthProgressChart';
import { VolumeChart } from '@/components/charts/VolumeChart';
import { WeightTrendChart } from '@/components/charts/WeightTrendChart';

interface ProgressViewProps {
  userId?: string;
}

type ChartTab = 'all' | 'strength' | 'volume' | 'weight';

export const ProgressView: React.FC<ProgressViewProps> = ({ userId: propUserId }) => {
  const { session } = useAuth();
  const userId = propUserId || session.user?.id || 'guest-user';
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [prHistory, setPrHistory] = useState<PRHistoryEvent[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [weightEntries, setWeightEntries] = useState<ProgressEntry[]>([]);
  const [activeTab, setActiveTab] = useState<ChartTab>('all');
  const [selectedExerciseFilter, setSelectedExerciseFilter] = useState<string>('all');
  const [activeSharePR, setActiveSharePR] = useState<PersonalRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const handleOpenPRShare = (pr: PersonalRecord) => {
    setActiveSharePR(pr);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [prData, historyData, weightData, prHistoryData] = await Promise.all([
          workoutService.getPersonalRecords(userId),
          workoutService.getWorkoutHistory(userId),
          progressService.getProgressEntries(userId),
          workoutService.getPRHistory(userId),
        ]);
        setPrs(prData);
        setHistory(historyData);
        setWeightEntries(weightData);
        setPrHistory(prHistoryData);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handleLogWeight = async (weightKg: number, notes?: string) => {
    const res = await progressService.logWeight(userId, weightKg, undefined, notes);
    if (res.success && res.entry) {
      setWeightEntries(prev => {
        const updated = [...prev, res.entry!];
        return updated.sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime());
      });
    }
  };

  const handleDeleteWeightEntry = async (id: string) => {
    await progressService.deleteProgressEntry(userId, id);
    setWeightEntries(prev => prev.filter(e => e.id !== id));
  };

  const distinctExercises = React.useMemo(() => {
    const map = new Map<string, string>();
    prHistory.forEach(item => {
      if (item.exerciseId && item.exerciseName) {
        map.set(item.exerciseId, item.exerciseName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [prHistory]);

  const filteredPRHistory = React.useMemo(() => {
    if (selectedExerciseFilter === 'all') return prHistory;
    return prHistory.filter(item => item.exerciseId === selectedExerciseFilter);
  }, [prHistory, selectedExerciseFilter]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading training analytics & personal records...</p>
      </div>
    );
  }

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-accent">Performance Analytics</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Historical Trajectory</span>
        </div>
        <h1>Progress & Personal Records</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Authoritative calculations derived from completed workout sets, cumulative tonnage, and bodyweight logs.
        </p>
      </div>

      {/* Visual Analytics Segmented Switcher */}
      <div
        className="chip-scroll-container"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('all')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <Layers size={15} /> All Charts
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'strength' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('strength')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <TrendingUp size={15} /> Strength Progression
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'volume' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('volume')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <BarChart3 size={15} /> Training Volume
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'weight' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('weight')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
        >
          <Scale size={15} /> Body Weight
        </button>
      </div>

      {/* Interactive Charts Section */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        {(activeTab === 'all' || activeTab === 'strength') && (
          <StrengthProgressChart sessions={history} />
        )}

        {(activeTab === 'all' || activeTab === 'volume') && (
          <VolumeChart sessions={history} />
        )}

        {(activeTab === 'all' || activeTab === 'weight') && (
          <WeightTrendChart
            entries={weightEntries}
            onLogWeight={handleLogWeight}
            onDeleteEntry={handleDeleteWeightEntry}
          />
        )}
      </div>

      {/* Personal Records Cards */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Trophy size={20} color="var(--accent-primary)" /> All-Time Personal Records
        </h3>

        {prs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Complete your first workout session to start tracking personal records automatically.</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 'var(--space-4)' }}>
            {prs.map(pr => (
              <div key={pr.id} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <h4 style={{ fontSize: '1.1rem' }}>{pr.exerciseName}</h4>
                    <span className="badge badge-accent">PR</span>
                  </div>

                  <div style={{ margin: 'var(--space-3) 0' }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
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

      {/* PERSONAL BEST TIMELINE (Feature 2) */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <History size={20} color="var(--accent-primary)" /> Personal Best Timeline
            </h3>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              Chronological milestone feed of every record breakthrough
            </small>
          </div>

          {distinctExercises.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter timeline by exercise"
                className="select select-sm"
                value={selectedExerciseFilter}
                onChange={e => setSelectedExerciseFilter(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="all">All Movements ({prHistory.length})</option>
                {distinctExercises.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filteredPRHistory.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', borderColor: 'var(--border-subtle)' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {selectedExerciseFilter === 'all'
                ? 'No milestone breakthroughs logged in timeline yet. Complete workouts and break records to build your timeline!'
                : 'No historical milestones for the selected exercise.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              paddingLeft: 'var(--space-6)',
              borderLeft: '2px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              marginLeft: 'var(--space-2)',
            }}
          >
            {filteredPRHistory.map((item) => (
              <div
                key={item.id}
                className="card card-interactive"
                style={{
                  position: 'relative',
                  padding: 'var(--space-3) var(--space-4)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {/* Glowing timeline node */}
                <div
                  style={{
                    position: 'absolute',
                    left: 'calc(-1 * var(--space-6) - 5px)',
                    top: '18px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 8px var(--accent-primary)',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(item.achievedAt)}
                    </span>
                    <h4 style={{ margin: '2px 0 var(--space-1)', fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {item.exerciseName || 'Exercise'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                        {item.weightKg} kg
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        × {item.reps} {item.reps === 1 ? 'rep' : 'reps'}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          background: 'var(--accent-primary-muted)',
                          color: 'var(--accent-primary)',
                          border: '1px solid rgba(79, 140, 255, 0.3)',
                          padding: '2px 6px',
                        }}
                      >
                        1RM: {item.estimatedOneRepMax} kg
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      handleOpenPRShare({
                        id: item.id,
                        userId: item.userId,
                        exerciseId: item.exerciseId,
                        exerciseName: item.exerciseName,
                        weightKg: item.weightKg,
                        reps: item.reps,
                        estimatedOneRepMax: item.estimatedOneRepMax,
                        achievedAt: item.achievedAt,
                      })
                    }
                    style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                    title="Share record milestone"
                  >
                    <Share2 size={12} /> Share
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
                border: '2px solid var(--accent-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8) var(--space-6)',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div className="badge badge-accent" style={{ marginBottom: 'var(--space-4)' }}>
                NEW PERSONAL RECORD
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-heading)' }}>{activeSharePR.exerciseName}</h2>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
                {activeSharePR.weightKg} <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>KG</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontSize: '1.1rem' }}>
                {activeSharePR.reps} {activeSharePR.reps === 1 ? 'rep' : 'reps'} @ 1RM {activeSharePR.estimatedOneRepMax} kg
              </div>
              <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                VERIFIED BY {PRODUCT_NAME.toUpperCase()} • {formatDate(activeSharePR.achievedAt)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                className="btn btn-primary btn-block"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `🏆 Hit a new PR on ${PRODUCT_NAME}: ${activeSharePR.exerciseName} - ${activeSharePR.weightKg}kg for ${activeSharePR.reps} reps (1RM: ${activeSharePR.estimatedOneRepMax}kg)!`
                  );
                  alert('PR achievement copied to clipboard!');
                  setActiveSharePR(null);
                }}
              >
                Copy PR Summary
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveSharePR(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
