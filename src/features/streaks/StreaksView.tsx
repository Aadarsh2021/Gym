import React, { useState, useEffect } from 'react';
import { Flame, Coins, Shield, Award, RotateCcw } from 'lucide-react';
import { streakService } from '@/services/streak.service';
import { UserStreak, FitnessCoinTransaction } from '@/types/streak.types';
import { formatDate } from '@/utils/formatters';

interface StreaksViewProps {
  userId: string;
}

export const StreaksView: React.FC<StreaksViewProps> = ({ userId }) => {
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [coins, setCoins] = useState<number>(0);
  const [transactions, setTransactions] = useState<FitnessCoinTransaction[]>([]);
  const [reviving, setReviving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [s, c, t] = await Promise.all([
      streakService.getStreak(userId),
      streakService.getCoinBalance(userId),
      streakService.getCoinHistory(userId),
    ]);
    setStreak(s);
    setCoins(c);
    setTransactions(t);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleUseRevive = async () => {
    setReviving(true);
    setMessage(null);
    try {
      const key = `revive-${Date.now()}`;
      const res = await streakService.useRevive(key);
      if (res.success) {
        setMessage('Streak successfully restored!');
        await loadData();
      } else {
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
        <span className="badge badge-fire" style={{ marginBottom: 'var(--space-1)' }}>Consistency Ledger</span>
        <h1>Streaks & Rewards</h1>
        <p>Your consistency is rewarded authoritatively. Complete scheduled workouts to protect your streak.</p>
      </div>

      {message && (
        <div style={{
          padding: 'var(--space-3)',
          background: 'rgba(212, 255, 0, 0.1)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          {message}
        </div>
      )}

      {/* Top Banner Cards */}
      <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {/* Streak Counter */}
        <div className="card card-glow" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ padding: '16px', background: 'rgba(255, 77, 77, 0.15)', borderRadius: 'var(--radius-xl)', color: 'var(--accent-fire)' }}>
            <Flame size={40} fill="var(--accent-fire)" />
          </div>
          <div>
            <small style={{ textTransform: 'uppercase' }}>Current Active Streak</small>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--accent-fire)' }}>
              {streak.currentStreak} <span style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Days</span>
            </div>
            <small style={{ color: 'var(--text-muted)' }}>Longest Streak: {streak.longestStreak} days</small>
          </div>
        </div>

        {/* Coin Balance */}
        <div className="card" style={{ borderColor: 'rgba(255, 184, 0, 0.3)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div style={{ padding: '16px', background: 'rgba(255, 184, 0, 0.15)', borderRadius: 'var(--radius-xl)', color: 'var(--accent-amber)' }}>
            <Coins size={40} />
          </div>
          <div>
            <small style={{ textTransform: 'uppercase' }}>Authoritative Coin Balance</small>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--accent-amber)' }}>
              {coins} <span style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Coins</span>
            </div>
            <small style={{ color: 'var(--text-muted)' }}>Earned through workouts & milestones</small>
          </div>
        </div>
      </div>

      {/* Streak Protection & Revives */}
      <div className="card" style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '12px', background: 'rgba(0, 240, 255, 0.15)', borderRadius: 'var(--radius-lg)', color: 'var(--accent-secondary)' }}>
            <Shield size={26} />
          </div>
          <div>
            <h3>Free Streak Revives</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Get 3 free revives every calendar month if you accidentally missed a workout day.
            </p>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={handleUseRevive}
          disabled={reviving}
        >
          {reviving ? <span className="spinner" /> : <><RotateCcw size={16} /> Restore Streak</>}
        </button>
      </div>

      {/* Milestones */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Streak Milestones</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          {milestones.map(m => (
            <div
              key={m.days}
              className={`card ${m.unlocked ? 'card-glow' : ''}`}
              style={{
                opacity: m.unlocked ? 1 : 0.6,
                borderColor: m.unlocked ? 'var(--accent-primary)' : 'var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <Award size={20} color={m.unlocked ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span className={`badge ${m.unlocked ? 'badge-lime' : ''}`}>
                  {m.unlocked ? 'Unlocked' : `${m.days} Days`}
                </span>
              </div>
              <h4>{m.label}</h4>
              <small style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>+{m.coins} Fitness Coins</small>
            </div>
          ))}
        </div>
      </div>

      {/* Append-Only Coin Ledger */}
      <div className="card">
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
                  background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {t.source.replace('_', ' ')}
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDate(t.createdAt)} {t.referenceId ? `• Ref: ${t.referenceId}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--accent-amber)', fontSize: '1.1rem' }}>
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
