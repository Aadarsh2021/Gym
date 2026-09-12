import React, { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { WorkoutSession } from '@/types/workout.types';
import { formatDate } from '@/utils/formatters';

interface SessionVolumePoint {
  id: string;
  name: string;
  date: string;
  totalVolumeKg: number;
  completedSets: number;
}

interface VolumeChartProps {
  sessions: WorkoutSession[];
}

export const VolumeChart: React.FC<VolumeChartProps> = ({ sessions }) => {
  // Aggregate volume for each session
  const dataPoints: SessionVolumePoint[] = useMemo(() => {
    // Chronological order (oldest to newest), limit to last 10 sessions for clear bar width
    const sorted = [...sessions]
      .filter(s => s.status === 'completed' || s.durationSeconds > 0)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .slice(-10);

    return sorted.map(session => {
      let volume = 0;
      let setsCount = 0;

      session.exercises?.forEach(ex => {
        ex.sets?.forEach(s => {
          if (s.completed && s.weightKg > 0 && s.reps > 0) {
            volume += s.weightKg * s.reps;
            setsCount++;
          }
        });
      });

      return {
        id: session.id,
        name: session.name,
        date: session.startedAt,
        totalVolumeKg: Math.round(volume),
        completedSets: setsCount,
      };
    });
  }, [sessions]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG dimensions
  const width = 600;
  const height = 240;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  // Max volume calculation
  const maxVolume = dataPoints.length > 0 ? Math.max(...dataPoints.map(d => d.totalVolumeKg)) : 1000;
  const yUpper = Math.ceil((maxVolume * 1.15) / 1000) * 1000 || 1000;

  // Average volume
  const avgVolume = dataPoints.length > 0
    ? Math.round(dataPoints.reduce((s, d) => s + d.totalVolumeKg, 0) / dataPoints.length)
    : 0;

  const barWidth = dataPoints.length > 0
    ? Math.min(36, Math.max(14, (chartWidth / dataPoints.length) * 0.55))
    : 24;

  const getBarX = (index: number) => {
    const slotWidth = chartWidth / dataPoints.length;
    return padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
  };

  const getBarHeight = (vol: number) => {
    return (vol / yUpper) * chartHeight;
  };

  return (
    <div className="card card-elevated" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      {/* Header */}
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
              background: 'var(--accent-indigo-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-indigo)',
              border: '1px solid var(--accent-indigo-border)',
            }}
          >
            <BarChart3 size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Training Volume Tonnage</h3>
            <small style={{ color: 'var(--text-muted)' }}>Session cumulative workload (sets × reps × weight)</small>
          </div>
        </div>

        {avgVolume > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Session:</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {avgVolume.toLocaleString()} kg
            </span>
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
          <BarChart3 size={32} color="var(--text-muted)" style={{ margin: '0 auto var(--space-3)' }} />
          <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--text-primary)' }}>
            {dataPoints.length === 1 ? '1 Workout Session Logged' : 'No Volume History Yet'}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
            {dataPoints.length === 1
              ? 'Complete a second workout session to unlock session-over-session workload comparisons.'
              : 'Complete and finalize workout sessions in the workout tracker to start measuring cumulative volume load.'}
          </p>
        </div>
      ) : (
        <div>
          {/* Legend - Strict Indigo Palette */}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  background: 'var(--accent-indigo)',
                  borderRadius: '2px',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Session Volume (kg)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '14px',
                  height: '2px',
                  borderBottom: '2px dashed var(--accent-indigo-border)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Average Line</span>
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
                const yVal = Math.round(yUpper * (1 - ratio));
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
                      {yVal >= 1000 ? `${(yVal / 1000).toFixed(1)}k` : yVal}kg
                    </text>
                  </g>
                );
              })}

              {/* Average Volume Reference Line (Monochrome Indigo) */}
              {avgVolume > 0 && (
                <line
                  x1={padLeft}
                  y1={padTop + chartHeight - (avgVolume / yUpper) * chartHeight}
                  x2={width - padRight}
                  y2={padTop + chartHeight - (avgVolume / yUpper) * chartHeight}
                  stroke="var(--accent-indigo)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              )}

              {/* Volume Bars - Strictly #3B4B6B monochrome/opacity variations */}
              {dataPoints.map((d, i) => {
                const x = getBarX(i);
                const barH = Math.max(4, getBarHeight(d.totalVolumeKg));
                const y = padTop + chartHeight - barH;
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={d.id || i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Bar Rectangle - Strict #3B4B6B with opacity variation */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx="3"
                      ry="3"
                      fill="var(--accent-indigo)"
                      fillOpacity={isHovered ? 0.95 : 0.70}
                      stroke="var(--accent-indigo)"
                      strokeWidth={isHovered ? 1.5 : 1}
                    />

                    {/* Date label under x-axis */}
                    <text
                      x={x + barWidth / 2}
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
                  border: '1px solid var(--accent-indigo)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '0.82rem',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '4px' }}>
                  {formatDate(dataPoints[hoveredIndex].date)} • {dataPoints[hoveredIndex].name}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div>
                    Total Workload: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {dataPoints[hoveredIndex].totalVolumeKg.toLocaleString()} kg
                    </strong>
                  </div>
                  <div>
                    Sets: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {dataPoints[hoveredIndex].completedSets}
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
