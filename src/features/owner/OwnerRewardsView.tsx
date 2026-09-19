import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  Plus,
  Gift,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  X,
  Trash2,
  Ticket,
} from 'lucide-react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { gymRepository } from '@/repositories/gym.repository';
import { GymReward, GymRewardRedemption } from '@/types/gym.types';
import { formatDate } from '@/utils/formatters';

export const OwnerRewardsView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  const [rewards, setRewards] = useState<GymReward[]>([]);
  const [redemptions, setRedemptions] = useState<GymRewardRedemption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'perks' | 'redemptions'>('perks');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formRequiredVisits, setFormRequiredVisits] = useState<number>(15);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Desk Redemption Action State
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeGym) return;
    try {
      setLoading(true);
      setError(null);
      const [rewardList, redemptionList] = await Promise.all([
        gymRepository.fetchGymRewards(activeGym.id),
        gymRepository.fetchOwnerRedemptions(activeGym.id),
      ]);
      setRewards(rewardList);
      setRedemptions(redemptionList);
    } catch {
      setError('Failed to load gym rewards');
    } finally {
      setLoading(false);
    }
  }, [activeGym]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym || !formTitle.trim() || formRequiredVisits <= 0) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await gymRepository.createGymReward({
        gymId: activeGym.id,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        requiredVisits: Number(formRequiredVisits),
        isActive: formIsActive,
      });

      if (!res.success) {
        setError(res.error || 'Failed to create reward milestone');
        return;
      }

      setSuccessMsg('Milestone reward configured successfully!');
      setIsModalOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormRequiredVisits(15);
      setFormIsActive(true);
      await loadData();
    } catch {
      setError('An error occurred while creating the reward');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (reward: GymReward) => {
    try {
      const res = await gymRepository.updateGymReward(reward.id, {
        gymId: reward.gymId,
        isActive: !reward.isActive,
      });
      if (res.success) {
        await loadData();
      }
    } catch {
      setError('Failed to toggle reward status');
    }
  };

  const handleDelete = async (reward: GymReward) => {
    if (!window.confirm(`Delete reward "${reward.title}"?`)) return;
    try {
      const res = await gymRepository.deleteGymReward(reward.id, reward.gymId);
      if (res.success) {
        setSuccessMsg('Milestone reward deleted.');
        await loadData();
      } else {
        setError(res.error || 'Failed to delete reward');
      }
    } catch {
      setError('Failed to delete reward');
    }
  };

  const handleRedeemAtDesk = async (redemptionId: string) => {
    try {
      setRedeemingId(redemptionId);
      setError(null);
      const res = await gymRepository.redeemGymReward(redemptionId);
      if (!res.success) {
        setError(res.error || 'Redemption validation failed');
        return;
      }
      setSuccessMsg('Perk marked as redeemed successfully at the desk!');
      await loadData();
    } catch {
      setError('An error occurred while validating redemption');
    } finally {
      setRedeemingId(null);
    }
  };

  const activePerksCount = rewards.filter(r => r.isActive).length;
  const claimedCount = redemptions.filter(r => r.status === 'claimed').length;
  const fulfilledCount = redemptions.filter(r => r.status === 'redeemed').length;

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Award size={16} />
            <span>PERKS & INCENTIVES</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Rewards</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Configure attendance incentives, merchandise discounts, and loyalty perks for frequent gym attendees.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
            disabled={!activeGym}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Milestone Reward</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--accent-fire)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-fire)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Perks</span>
            <Gift size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activePerksCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configured attendance milestones</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Awaiting Desk Pickup</span>
            <Ticket size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{claimedCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Claimed codes to verify</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fulfilled Redemptions</span>
            <CheckCircle2 size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fulfilledCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total perks awarded</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-6)' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'perks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('perks')}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}
        >
          Configured Milestones ({rewards.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'redemptions' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('redemptions')}
          style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}
        >
          Desk Redemptions & Verification ({redemptions.length})
        </button>
      </div>

      {loadingGym || loading ? (
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)', color: 'var(--accent-primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading rewards data...</p>
        </div>
      ) : activeTab === 'perks' ? (
        rewards.length === 0 ? (
          <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
            <Award size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Rewards Configured</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto var(--space-4)' }}>
              Define custom incentives such as a free shaker bottle, 10% smoothie bar discount, or free guest pass after 15 gym check-ins.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsModalOpen(true)}
              disabled={!activeGym}
            >
              Configure First Milestone
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
            {rewards.map(reward => (
              <div
                key={reward.id}
                className="card card-elevated"
                style={{
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: reward.isActive ? '1px solid var(--border-subtle)' : '1px dashed var(--border-subtle)',
                  opacity: reward.isActive ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: 'var(--accent-gold)',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                      }}
                    >
                      {reward.requiredVisits} Visits Milestone
                    </span>

                    <span
                      className="badge"
                      style={{
                        background: reward.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.2)',
                        color: reward.isActive ? 'var(--color-success)' : 'var(--text-muted)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {reward.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
                    {reward.title}
                  </h3>

                  {reward.description && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                      {reward.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleToggleActive(reward)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {reward.isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(reward)}
                    style={{ color: 'var(--accent-fire)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Redemptions Tab */
        redemptions.length === 0 ? (
          <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
            <Ticket size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Member Redemptions Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              When members achieve unique visit milestones and claim their perks, their verification tickets will appear here.
            </p>
          </div>
        ) : (
          <div className="card card-elevated" style={{ overflow: 'hidden', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>Verification Code</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>Milestone Perk</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>Claimed Date</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, textAlign: 'right' }}>Desk Action</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map(red => {
                  const isRedeemed = red.status === 'redeemed';
                  return (
                    <tr key={red.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <code style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                          {red.redemptionCode}
                        </code>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{ fontWeight: 600 }}>{red.reward?.title || 'Milestone Reward'}</span>
                        {red.reward?.requiredVisits && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {red.reward.requiredVisits} visits required
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                        {formatDate(red.claimedAt)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          className="badge"
                          style={{
                            background: isRedeemed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: isRedeemed ? 'var(--color-success)' : 'var(--accent-gold)',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {isRedeemed ? '✓ Redeemed' : '⏳ Ready for Pickup'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        {isRedeemed ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Fulfilled {red.redeemedAt ? formatDate(red.redeemedAt) : ''}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRedeemAtDesk(red.id)}
                            disabled={redeemingId === red.id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            {redeemingId === red.id ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            <span>Mark Redeemed</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal: New Reward */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card card-elevated animate-fade-in"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Gift size={20} style={{ color: 'var(--accent-gold)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Configure Milestone Perk</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReward} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Reward Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Free FitBoost Shaker Bottle / Protein Smoothie"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Required Unique Visits *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="15"
                  value={formRequiredVisits}
                  onChange={e => setFormRequiredVisits(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Multiple visits on the same calendar day count as 1 visit.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Description / Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Present verification code at reception counter to claim..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="activePerk"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="activePerk" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Active and claimable by enrolled athletes
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Award size={14} />}
                  <span>Save Milestone</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
