import React, { useState } from 'react';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { ProgressEntry } from '@/services/progress.service';
import { formatDate } from '@/utils/formatters';

interface WeightTrendChartProps {
  entries: ProgressEntry[];
  onLogWeight: (weightKg: number, notes?: string) => Promise<void>;
  onDeleteEntry?: (id: string) => Promise<void>;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  entries,
  onLogWeight,
  onDeleteEntry,
}) => {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [inputWeight, setInputWeight] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Chronological sort
  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime()
  );

  const currentWeight = sorted.length > 0 ? sorted[sorted.length - 1].weightKg : null;
  const initialWeight = sorted.length > 0 ? sorted[0].weightKg : null;
  const deltaWeight = currentWeight !== null && initialWeight !== null
    ? Math.round((currentWeight - initialWeight) * 10) / 10
    : null;

  // SVG dimensions
  const width = 600;
  const height = 220;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const weights = sorted.map(d => d.weightKg);
  const minVal = weights.length > 0 ? Math.max(30, Math.floor(Math.min(...weights) - 2)) : 50;
  const maxVal = weights.length > 0 ? Math.ceil(Math.max(...weights) + 2) : 90;
  const range = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (sorted.length <= 1) return padLeft + chartWidth / 2;
    return padLeft + (index / (sorted.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padTop + chartHeight - ((val - minVal) / range) * chartHeight;
  };

  const pointsStr = sorted.map((d, i) => `${getX(i)},${getY(d.weightKg)}`).join(' ');

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(inputWeight);
    if (!weightNum || weightNum <= 0) return;

    setSubmitting(true);
    try {
      await onLogWeight(weightNum, inputNotes.trim() || undefined);
      setInputWeight('');
      setInputNotes('');
      setIsLogOpen(false);
    } finally {
      setSubmitting(false);
    }
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
              background: 'var(--accent-cyan-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-cyan)',
            }}
          >
            <Scale size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Body Weight Trend</h3>
            <small style={{ color: 'var(--text-muted)' }}>Historical weigh-ins and weight stability</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {currentWeight !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {currentWeight} kg
              </div>
              {deltaWeight !== null && (
                <small style={{ color: deltaWeight > 0 ? 'var(--color-warning)' : 'var(--accent-primary)', fontWeight: 600 }}>
                  {deltaWeight > 0 ? `+${deltaWeight}` : deltaWeight} kg net
                </small>
              )}
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsLogOpen(prev => !prev)}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            <Plus size={15} /> Log Weight
          </button>
        </div>
      </div>

      {/* Log Form Drawer/Panel */}
      {isLogOpen && (
        <form
          onSubmit={handleSubmitLog}
          style={{
            padding: 'var(--space-4)',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: '1 1 140px' }}>
            <label className="label" style={{ fontSize: '0.78rem' }}>Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              className="input"
              placeholder="e.g. 74.5"
              value={inputWeight}
              onChange={e => setInputWeight(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ flex: '2 1 200px' }}>
            <label className="label" style={{ fontSize: '0.78rem' }}>Notes (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Morning fasting, post-deload"
              value={inputNotes}
              onChange={e => setInputNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting}
            style={{ padding: '9px 18px' }}
          >
            {submitting ? 'Saving...' : 'Save Weigh-in'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsLogOpen(false)}
            style={{ padding: '9px 12px' }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Empty State */}
      {sorted.length < 2 ? (
        <div
          style={{
            padding: 'var(--space-10) var(--space-4)',
            textAlign: 'center',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-medium)',
          }}
        >
          <Scale size={32} color="var(--text-muted)" style={{ margin: '0 auto var(--space-3)' }} />
          <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--text-primary)' }}>
            {sorted.length === 1 ? '1 Weigh-in Logged' : 'No Weight Logs Yet'}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto var(--space-4)' }}>
            {sorted.length === 1
              ? `Current logged weight is ${sorted[0].weightKg} kg. Log a second weigh-in to render your bodyweight progression curve.`
              : 'Log your morning bodyweight periodically to track muscular gain or fat reduction trajectory.'}
          </p>
          {!isLogOpen && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsLogOpen(true)}
            >
              <Plus size={16} /> Log First Weigh-in
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* SVG Chart Container */}
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: '100%', height: 'auto', minWidth: '400px', display: 'block' }}
            >
              {/* Horizontal Gridlines & Y-Axis Labels */}
              {[0, 0.33, 0.66, 1].map((ratio, i) => {
                const yVal = Math.round((minVal + (1 - ratio) * range) * 10) / 10;
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

              {/* Weight Trend Line */}
              <polyline
                fill="none"
                stroke="var(--accent-cyan)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsStr}
              />

              {/* Data Points */}
              {sorted.map((d, i) => {
                const x = getX(i);
                const y = getY(d.weightKg);
                const isHovered = hoveredIndex === i;

                return (
                  <g
                    key={d.id || i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover guide */}
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

                    <circle
                      cx={x}
                      y={y}
                      r={isHovered ? 6 : 4.5}
                      fill="var(--accent-cyan)"
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
                      {formatDate(d.recordedDate).split(' ')[0]} {formatDate(d.recordedDate).split(' ')[1]}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Box */}
            {hoveredIndex !== null && sorted[hoveredIndex] && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  padding: '8px 12px',
                  background: 'rgba(10, 14, 26, 0.95)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '0.82rem',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginBottom: '4px' }}>
                  {formatDate(sorted[hoveredIndex].recordedDate)}
                  {sorted[hoveredIndex].notes && ` • ${sorted[hoveredIndex].notes}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div>
                    Weight: <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {sorted[hoveredIndex].weightKg} kg
                    </strong>
                  </div>
                  {onDeleteEntry && (
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(sorted[hoveredIndex].id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-error)',
                        cursor: 'pointer',
                        padding: 0,
                        pointerEvents: 'auto',
                      }}
                      title="Delete Entry"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
