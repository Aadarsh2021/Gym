import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { rewardsService } from '@/services/rewards.service';
import { gymRepository } from '@/repositories/gym.repository';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { FitnessRewardItem, FitnessRewardRedemption } from '@/types/rewards.types';
import { GymReward } from '@/types/gym.types';
import {
  Coins,
  Gift,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  Award,
  Key,
  Building2,
} from 'lucide-react';

export const RewardsShopView: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id || '';

  // Safe MemberGymContext consumption
  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }

  const isIntegrated = memberGymCtx?.mode === 'integrated' && Boolean(memberGymCtx?.activeGym);
  const activeGym = memberGymCtx?.activeGym ?? null;

  const [balance, setBalance] = useState<number>(0);
  const [catalog, setCatalog] = useState<FitnessRewardItem[]>([]);
  const [gymRewards, setGymRewards] = useState<GymReward[]>([]);
  const [redemptions, setRedemptions] = useState<FitnessRewardRedemption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'gym_perks' | 'history'>('catalog');

  const [confirmModalItem, setConfirmModalItem] = useState<FitnessRewardItem | null>(null);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const promises: Promise<any>[] = [
        rewardsService.getBalance(),
        rewardsService.getCatalog(),
        rewardsService.getRedemptions(userId),
      ];

      if (isIntegrated && activeGym?.id) {
        promises.push(gymRepository.fetchGymRewards(activeGym.id));
      }

      const [bal, items, history, gRewards] = await Promise.all(promises);
      setBalance(bal?.balance ?? 0);
      setCatalog(items ?? []);
      setRedemptions(history ?? []);
      if (gRewards) {
        setGymRewards(gRewards);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load rewards shop');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isIntegrated, activeGym?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRedeem = async () => {
    if (!confirmModalItem) return;

    try {
      setRedeeming(true);
      setErrorMessage(null);
      const result = await rewardsService.redeem(confirmModalItem.id);
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccessMessage(`Successfully redeemed "${confirmModalItem.title}"! Claim code: ${result.redemptionCode || 'N/A'}`);
        setConfirmModalItem(null);
        await loadData();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to complete redemption');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div
      className="container animate-fade-in"
      style={{
        padding: 'var(--space-4) var(--space-4) var(--space-12)',
        maxWidth: '1080px',
        margin: '0 auto',
      }}
      data-testid="rewards-shop-view"
    >
      {/* Header & Balance Banner */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--accent-primary)',
              marginBottom: '4px',
            }}
          >
            <Coins size={15} />
            <span>FitCoins Reward Center</span>
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: '0 0 var(--space-1)',
              letterSpacing: '-0.02em',
            }}
          >
            Rewards Shop
          </h1>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: '540px',
              lineHeight: 1.45,
            }}
          >
            Redeem coins earned through consistent workout logging, streak milestones, and personal records.
          </p>
        </div>

        {/* Balance Card — Standard FitSphere Blue/Graphite Card */}
        <div
          className="card card-elevated"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-5)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary-muted)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={22} />
          </div>
          <div>
            <span
              style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
              }}
            >
              Your Coin Balance
            </span>
            <div
              data-testid="user-coin-balance"
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {balance.toLocaleString()}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                FITCOINS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div
          className="card"
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-error-muted)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.88rem' }}>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn btn-ghost btn-sm"
            aria-label="Dismiss error notification"
            style={{ padding: '4px', minHeight: '32px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="card"
          role="status"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-success-muted)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.88rem' }}>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="btn btn-ghost btn-sm"
            aria-label="Dismiss success notification"
            style={{ padding: '4px', minHeight: '32px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs & Refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`btn btn-sm ${activeTab === 'catalog' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: '38px', gap: '6px' }}
          >
            <Gift size={15} />
            <span>Personal Rewards ({catalog.length})</span>
          </button>

          {isIntegrated && activeGym && (
            <button
              onClick={() => setActiveTab('gym_perks')}
              className={`btn btn-sm ${activeTab === 'gym_perks' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ minHeight: '38px', gap: '6px' }}
            >
              <Building2 size={15} />
              <span>Club Perks ({gymRewards.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ minHeight: '38px', gap: '6px' }}
          >
            <History size={15} />
            <span>Redemption History ({redemptions.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadData();
          }}
          disabled={refreshing || loading}
          className="btn btn-secondary btn-sm"
          style={{ minHeight: '38px', gap: '6px' }}
          aria-label="Refresh rewards"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
          <div className="spinner" style={{ width: '30px', height: '30px' }} />
        </div>
      ) : activeTab === 'catalog' ? (
        catalog.length === 0 ? (
          <div
            className="card card-elevated text-center"
            style={{
              padding: 'var(--space-12) var(--space-6)',
              borderStyle: 'dashed',
            }}
          >
            <Gift size={46} style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
              No Rewards Available Right Now
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
              The reward catalog is currently empty. Check back soon for new digital perks, pro training passes, and partner discounts!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {catalog.map((item) => {
              const canAfford = balance >= item.coinCost;

              return (
                <div
                  key={item.id}
                  className="card card-elevated card-interactive"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 'var(--space-5)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        <Coins size={15} />
                        <span>{item.coinCost}</span>
                      </div>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: '0 0 var(--space-2)',
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                        margin: '0 0 var(--space-4)',
                      }}
                    >
                      {item.description}
                    </p>
                  </div>

                  <div
                    style={{
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Personal Core
                    </span>

                    <button
                      onClick={() => setConfirmModalItem(item)}
                      disabled={!canAfford}
                      className={`btn btn-sm ${canAfford ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        minHeight: '36px',
                        fontSize: '0.82rem',
                        gap: '6px',
                      }}
                    >
                      <span>{canAfford ? 'Redeem Perk' : 'Need More Coins'}</span>
                      {canAfford && <ArrowRight size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'gym_perks' ? (
        <div>
          {/* Gym Perks Explanatory Banner */}
          <div
            className="card"
            style={{
              padding: 'var(--space-4)',
              background: 'var(--accent-primary-muted)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <Building2 size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Exclusive Perks for {activeGym?.name || 'Your Gym'} Members
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.45 }}>
                These perks are sponsored directly by your integrated club and unlocked via verified physical check-ins. They are distinct from and do NOT consume your Personal FitCoins balance.
              </p>
            </div>
          </div>

          {gymRewards.length === 0 ? (
            <div
              className="card card-elevated text-center"
              style={{
                padding: 'var(--space-12) var(--space-6)',
                borderStyle: 'dashed',
              }}
            >
              <Building2 size={46} style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)', opacity: 0.6 }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                No Club Perks Active
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
                Your facility management has not published attendance rewards yet. Check back soon or visit the front desk!
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {gymRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="card card-elevated card-interactive"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 'var(--space-5)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          background: 'var(--color-success-muted)',
                          color: 'var(--color-success)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        {reward.requiredVisits} Verified Visits
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Attendance Perk
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: '0 0 var(--space-2)',
                      }}
                    >
                      {reward.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        color: 'var(--text-secondary)',
                        margin: '0 0 var(--space-4)',
                      }}
                    >
                      {reward.description}
                    </p>
                  </div>

                  <div
                    style={{
                      paddingTop: 'var(--space-3)',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Facility Verified
                    </span>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--color-success)',
                      }}
                    >
                      Claim at Front Desk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : redemptions.length === 0 ? (
        <div
          className="card card-elevated text-center"
          style={{
            padding: 'var(--space-12) var(--space-6)',
            borderStyle: 'dashed',
          }}
        >
          <History size={46} style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            No Redemptions Yet
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
            When you redeem digital perks with your fitness coins, your redemption claim codes and history will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {redemptions.map((redemption) => (
            <div
              key={redemption.id}
              className="card card-elevated"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-success-muted)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Award size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {redemption.rewardTitle || 'Redeemed Fitness Perk'}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Redeemed on {new Date(redemption.createdAt).toLocaleDateString()} at{' '}
                    {new Date(redemption.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {redemption.redemptionCode && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Key size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{redemption.redemptionCode}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                  }}
                >
                  <span>-{redemption.coinSpent}</span>
                  <Coins size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Redemption Confirmation Modal */}
      {confirmModalItem && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmModalItem(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '440px',
              padding: 'var(--space-6)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <h3
                id="confirm-modal-title"
                style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}
              >
                Confirm Redemption
              </h3>
              <button
                onClick={() => setConfirmModalItem(null)}
                className="btn btn-ghost btn-sm"
                aria-label="Close dialog"
                style={{ padding: '4px', minHeight: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>
                Are you sure you want to redeem{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{confirmModalItem.title}</strong>?
              </p>

              <div
                className="card"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Current Balance:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {balance} coins
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--color-warning)' }}>
                  <span>Cost:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>-{confirmModalItem.coinCost} coins</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: 'var(--space-2)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>Remaining Balance:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                    {balance - confirmModalItem.coinCost} coins
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 'var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmModalItem(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRedeem}
                disabled={redeeming}
                className="btn btn-primary btn-sm"
              >
                {redeeming ? 'Redeeming...' : 'Confirm & Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
