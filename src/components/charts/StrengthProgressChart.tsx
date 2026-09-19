import React, { useState, useMemo } from 'react';
import { TrendingUp, Dumbbell } from 'lucide-react';
import { WorkoutSession } from '@/types/workout.types';
import { calculateOneRepMaxEpley } from '@/domain/pr-calculator';
import { formatDate } from '@/utils/formatters';

interface StrengthDataPoint {
  date: string;
  sessionName: string;
  topWeightKg: number;
  topReps: number;
  estimated1RM: number;
}

interface StrengthProgressChartProps {
  sessions: WorkoutSession[];
}

export const StrengthProgressChart: React.FC<StrengthProgressChartProps> = ({ sessions }) => {
  // Extract all unique completed exercises across sessions
  const availableExercises = useMemo(() => {
    const exerciseMap = new Map<string, string>();
    sessions.forEach(session => {
      session.exercises?.forEach(ex => {
        if (ex.exerciseName) {
          exerciseMap.set(ex.exerciseId, ex.exerciseName);
        }
      });
    });
    return Array.from(exerciseMap.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // Default to first available exercise or common compound lift
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(() => {
    if (availableExercises.length > 0) {
      // Prioritize bench, squat, deadlift if present
      const preferred = availableExercises.find(e =>
        /bench|squat|deadlift|press/i.test(e.name)
      );
      return preferred ? preferred.id : availableExercises[0].id;
    }
    return '';
  });

  // Extract history progression for selected exercise
  const dataPoints: StrengthDataPoint[] = useMemo(() => {
    if (!selectedExerciseId) return [];

    const points: StrengthDataPoint[] = [];

    // Chronological order (oldest to newest)
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    sorted.forEach(session => {
      const ex = session.exercises?.find(e => e.exerciseId === selectedExerciseId);
      if (!ex || !ex.sets || ex.sets.length === 0) return;

      const completedSets = ex.sets.filter(s => s.completed && s.weightKg > 0 && s.reps > 0);
      if (completedSets.length === 0) return;

      // Find top set and highest 1RM
      let topWeight = 0;
      let topReps = 0;
      let top1RM = 0;

      completedSets.forEach(s => {
        const e1rm = calculateOneRepMaxEpley(s.weightKg, s.reps);
        if (s.weightKg > topWeight) {
          topWeight = s.weightKg;
          topReps = s.reps;
        }
        if (e1rm > top1RM) {
          top1RM = e1rm;
        }
      });

      points.push({
        date: session.startedAt,
        sessionName: session.name,
        topWeightKg: topWeight,
        topReps,
        estimated1RM: Math.round(top1RM * 10) / 10,
      });
    });

    return points;
  }, [sessions, selectedExerciseId]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG dimensions
  const width = 600;
  const height = 240;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Min / Max calculations
  const values = dataPoints.flatMap(d => [d.topWeightKg, d.estimated1RM]);
  const minVal = values.length > 0 ? Math.max(0, Math.floor(Math.min(...values) * 0.85)) : 0;
  const maxVal = values.length > 0 ? Math.ceil(Math.max(...values) * 1.15) : 100;
  const range = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (dataPoints.length <= 1) return padLeft + chartWidth / 2;
    return padLeft + (index / (dataPoints.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padTop + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  // Generate SVG polyline path strings
  const weightPointsStr = dataPoints.map((d, i) => `${getX(i)},${getY(d.topWeightKg)}`).join(' ');
  const e1rmPointsStr = dataPoints.map((d, i) => `${getX(i)},${getY(d.estimated1RM)}`).join(' ');

  const selectedExerciseName =
    availableExercises.find(e => e.id === selectedExerciseId)?.name || 'Selected Exercise';

  return (
    <div className="card card-elevated" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      {/* Header & Exercise Selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              padding: '8px',
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
            }}
          >
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Strength Progression Curve</h3>
            <small style={{ color: 'var(--text-muted)' }}>Estimated 1RM and top working weight tracking</small>
          </div>
        </div>

        {availableExercises.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Dumbbell size={16} color="var(--text-muted)" />
            <select
              className="select"
              style={{ padding: '6px 12px', fontSize: '0.86rem', minWidth: '180px' }}
              value={selectedExerciseId}
              onChange={e => setSelectedExerciseId(e.target.value)}
            >
              {availableExercises.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Empty State */}
      {dataPoints.length < 2 ? (
        <div
          style={{
            padding: 'var(--space-10) var(--space-4)',
            textAlign: 'center',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-medium)',
          }}
        >
          <Dumbbell size={32} color="var(--text-muted)" style={{ margin: '0 auto var(--space-3)' }} />
          <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--text-primary)' }}>
            {dataPoints.length === 1 ? '1 Session Recorded' : 'No Lift History Yet'}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
            {dataPoints.length === 1
              ? `Log a second workout session with ${selectedExerciseName} to unlock the strength curve and estimated 1RM trajectory.`
              : `Complete workout sessions containing ${selectedExerciseName} to visualize your strength curve.`}
          </p>
        </div>
      ) : (
        <div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--accent-primary)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Top Weight (kg)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '2px', borderBottom: '2px dashed var(--color-info)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Estimated 1RM (kg)</span>
            </div>
          </div>

          {/* SVG Chart Container */}
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: '100%', height: 'auto', minWidth: '400px', display: 'block' }}
            >
              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0, 0.33, 0.66, 1].map((ratio, i) => {
                const yVal = Math.round(minVal + (1 - ratio) * range);
                const yPos = padTop + ratio * chartHeight;
                return (
                  <g key={i}>
                    <line
                      x1={padLeft}
                      y1={yPos}
                      x2={width - padRight}
                      y2={yPos}
                      stroke="var(--border-subtle)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={yPos + 4}
                      fill="var(--text-muted)"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="var(--font-mono)"
                    >
                      {yVal}kg
                    </text>
                  </g>
                );
              })}

              {/* Estimated 1RM Line (Dashed Info/Cyan) */}
              <polyline
                fill="none"
                stroke="var(--color-info)"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={e1rmPointsStr}
              />

              {/* Top Weight Line (Solid Accent Primary) */}
              <polyline
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={weightPointsStr}
              />

              {/* Data Points */}
              {dataPoints.map((d, i) => {
                const x = getX(i);
                const yWeight = getY(d.topWeightKg);
                const y1RM = getY(d.estimated1RM);
                const isHovered = hoveredIndex === i;

                return (
                  <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: 'pointer' }}>
                    {/* Hover vertical guide */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={height - padBottom}
                        stroke="rgba(255, 255, 255, 0.25)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* 1RM circle */}
                    <circle
                      cx={x}
                      y={y1RM}
                      r={isHovered ? 5 : 3.5}
                      fill="var(--color-info)"
                      stroke="var(--bg-card)"
                      strokeWidth="1.5"
                    />

                    {/* Top Weight circle */}
                    <circle
                      cx={x}
                      y={yWeight}
                      r={isHovered ? 6 : 4.5}
                      fill="var(--accent-primary)"
                      stroke="var(--bg-card)"
                      strokeWidth="1.5"
                    />

                    {/* Date label under x-axis */}
                    <text
                      x={x}
                      y={height - padBottom + 18}
                      fill={isHovered ? 'var(--text-primary)' : 'var(--text-muted)'}
                      fontSize="10"
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                    >
                      {formatDate(d.date).split(' ')[0]} {formatDate(d.date).split(' ')[1]}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Box */}
            {hoveredIndex !== null && dataPoints[hoveredIndex] && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  padding: '8px 12px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '0.82rem',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '4px' }}>
                  {formatDate(dataPoints[hoveredIndex].date)} • {dataPoints[hoveredIndex].sessionName}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div>
                    Top Set: <strong style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      {dataPoints[hoveredIndex].topWeightKg}kg × {dataPoints[hoveredIndex].topReps}
                    </strong>
                  </div>
                  <div>
                    Est 1RM: <strong style={{ color: 'var(--color-info)', fontFamily: 'var(--font-mono)' }}>
                      {dataPoints[hoveredIndex].estimated1RM}kg
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
