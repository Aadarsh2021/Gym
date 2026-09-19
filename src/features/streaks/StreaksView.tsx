import React, { useState, useEffect } from 'react';
import { Flame, Coins, Shield, Award, RotateCcw, Building2, ArrowRight } from 'lucide-react';
import { streakService } from '@/services/streak.service';
import { gymRepository } from '@/repositories/gym.repository';
import { UserStreak, FitnessCoinTransaction } from '@/types/streak.types';
import { GymAttendanceStreak } from '@/types/gym.types';
import { formatDate } from '@/utils/formatters';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { Link } from 'react-router-dom';

interface StreaksViewProps {
  userId: string;
}

export const StreaksView: React.FC<StreaksViewProps> = ({ userId }) => {
  // Safe consumption of MemberGymContext (fallback if rendered standalone in unit tests)
  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }

  const isIntegrated = memberGymCtx?.mode === 'integrated' && Boolean(memberGymCtx?.activeGym);
  const isExternalGym = memberGymCtx?.mode === 'non_integrated';
  const activeGym = memberGymCtx?.activeGym ?? null;

  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [gymStreak, setGymStreak] = useState<GymAttendanceStreak | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [transactions, setTransactions] = useState<FitnessCoinTransaction[]>([]);
  const [revivesRemaining, setRevivesRemaining] = useState<number>(3);
  const [reviving, setReviving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    const promises: Promise<any>[] = [
      streakService.getStreak(userId),
      streakService.getCoinBalance(userId),
      streakService.getCoinHistory(userId),
      streakService.getMonthlyRevivesStatus(userId),
    ];

    if (isIntegrated && activeGym?.id) {
      promises.push(gymRepository.getGymAttendanceStreak(activeGym.id, userId));
    }

    const [s, c, t, rStatus, gStreak] = await Promise.all(promises);
    setStreak(s);
    setCoins(c);
    setTransactions(t);
    setRevivesRemaining(rStatus.remaining);
    if (gStreak) {
      setGymStreak(gStreak);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId, isIntegrated, activeGym?.id]);

  const handleUseRevive = async () => {
    setReviving(true);
    setMessage(null);
    try {
      const key = `revive-${Date.now()}`;
      const res = await streakService.useRevive(key, userId);
      if (res.success) {
        setMessage(`Streak successfully restored! ${res.revivesRemaining ?? Math.max(0, revivesRemaining - 1)} revives remaining this month.`);
        await loadData();
      } else {
        if (res.isQuotaExceeded) {
          setRevivesRemaining(0);
        }
        setMessage(res.error || 'Failed to use revive.');
      }
    } catch {
      setMessage('Revive request failed.');
    } finally {
      setReviving(false);
    }
  };

  const milestones = [
    { days: 7, label: '7-Day Warrior', coins: 100, unlocked: streak.longestStreak >= 7 },
    { days: 14, label: '14-Day Machine', coins: 200, unlocked: streak.longestStreak >= 14 },
    { days: 30, label: '30-Day Iron Will', coins: 500, unlocked: streak.longestStreak >= 30 },
    { days: 50, label: '50-Day Centurion', coins: 1000, unlocked: streak.longestStreak >= 50 },
    { days: 100, label: '100-Day Legend', coins: 2500, unlocked: streak.longestStreak >= 100 },
  ];

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>
          {isIntegrated
            ? 'Integrated Facility & Personal Ledgers'
            : isExternalGym
            ? 'Commercial Gym Mode'
            : 'Personal Consistency'}
        </span>
        <h1>Streaks & Consistency</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isIntegrated
            ? `Your personal workout consistency and physical attendance at ${activeGym?.name || 'your club'} are tracked as distinct authoritative ledgers.`
            : isExternalGym
            ? 'Your personal workout consistency is recorded authoritatively. Workouts logged with commercial gym equipment count toward your Personal Workout Streak.'
            : 'Your consistency is recorded authoritatively. Complete scheduled workouts anywhere to protect your Personal Workout Streak.'}
        </p>
      </div>

      {message && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--accent-primary-muted)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          {message}
        </div>
      )}

      {/* Top Banner Cards */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: isIntegrated ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {/* Personal Workout Streak Tile */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', borderColor: 'var(--border-medium)' }}>
          <div style={{ padding: '16px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-primary)' }}>
            <Flame size={36} fill="var(--accent-primary)" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Personal Workout Streak
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', lineHeight: 1.1 }}>
              {streak.currentStreak} <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Days</span>
            </div>
            <small style={{ color: 'var(--text-muted)' }}>Longest Streak: {streak.longestStreak} days</small>
          </div>
        </div>

        {/* Integrated Facility Attendance Streak Tile (Only when integrated) */}
        {isIntegrated && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', borderColor: 'var(--border-medium)' }}>
            <div style={{ padding: '16px', background: 'var(--color-success-muted, rgba(16, 185, 129, 0.12))', borderRadius: 'var(--radius-lg)', color: 'var(--color-success, #10b981)' }}>
              <Building2 size={36} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Gym Attendance Streak
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-success, #10b981)', lineHeight: 1.1 }}>
                {gymStreak?.currentStreak ?? 0} <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <small style={{ color: 'var(--text-muted)' }}>
                  Total Visits: {gymStreak?.totalVisitDays ?? 0}
                </small>
                <Link
                  to="/app/gym/check-in"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    textDecoration: 'none',
                  }}
                >
                  Check In <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Coin Balance */}
        <div className="card" style={{ borderColor: 'var(--border-medium)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ padding: '16px', background: 'var(--color-warning-muted)', borderRadius: 'var(--radius-lg)', color: 'var(--color-warning)' }}>
            <Coins size={36} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Personal FitCoins
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--color-warning)', lineHeight: 1.1 }}>
              {coins} <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Coins</span>
            </div>
            <small style={{ color: 'var(--text-muted)' }}>Earned through workouts & milestones</small>
          </div>
        </div>
      </div>

      {/* Streak Protection & Revives */}
      <div className="card" style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', borderColor: 'var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
            <Shield size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Free Streak Revives</h3>
              <span className={`badge ${revivesRemaining > 0 ? 'badge-accent' : ''}`} style={{ fontSize: '0.72rem' }}>
                {revivesRemaining} of 3 Available This Month
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              {revivesRemaining > 0
                ? 'Get 3 free revives every calendar month (IST) if you accidentally missed a workout day.'
                : 'Monthly free revives exhausted (0/3). Additional streak revives are available as a paid add-on.'}
            </p>
          </div>
        </div>

        {revivesRemaining > 0 ? (
          <button
            className="btn btn-secondary"
            onClick={handleUseRevive}
            disabled={reviving}
          >
            {reviving ? <span className="spinner" /> : <><RotateCcw size={15} /> Restore Streak ({revivesRemaining} Free Left)</>}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Add-On Required</span>
            <button
              className="btn btn-secondary"
              disabled
              title="You have used all 3 free monthly revives. Paid add-on pack required."
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              Paid Add-On (Coming Soon)
            </button>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Streak Milestones</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          {milestones.map(m => (
            <div
              key={m.days}
              className="card"
              style={{
                opacity: m.unlocked ? 1 : 0.6,
                borderColor: m.unlocked ? 'var(--color-warning)' : 'var(--border-subtle)',
                background: m.unlocked ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <Award size={20} color={m.unlocked ? 'var(--color-warning)' : 'var(--text-muted)'} />
                <span className={`badge ${m.unlocked ? 'badge-warning' : ''}`}>
                  {m.unlocked ? 'Unlocked' : `${m.days} Days`}
                </span>
              </div>
              <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>{m.label}</h4>
              <small style={{ color: 'var(--color-warning)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>+{m.coins} Fitness Coins</small>
            </div>
          ))}
        </div>
      </div>

      {/* Append-Only Coin Ledger */}
      <div className="card" style={{ borderColor: 'var(--border-subtle)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Coin Ledger (Audit Trail)</h3>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No coin transactions recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {transactions.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-3)',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.9rem' }}>
                    {t.source.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDate(t.createdAt)} {t.referenceId ? `| Ref: ${t.referenceId}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                  +{t.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
