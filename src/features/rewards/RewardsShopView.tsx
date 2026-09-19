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
      setBalance(bal.balance);
      setCatalog(items);
      setRedemptions(history);
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
    <div className="mx-auto max-w-5xl p-4 sm:p-6 animate-fade-in" data-testid="rewards-shop-view">
      {/* Header & Balance Banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Coins className="h-4 w-4" />
            <span>Fitness Coin Rewards</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Rewards Shop</h1>
          <p className="mt-1 text-sm text-slate-400">
            Redeem coins earned through consistent workout logging, streak milestones, and personal records.
          </p>
        </div>

        {/* Balance Card */}
        <div className="flex items-center gap-3 self-start rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 sm:self-auto">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Your Coin Balance</span>
            <div className="text-xl font-black font-mono text-amber-400" data-testid="user-coin-balance">
              {balance.toLocaleString()} <span className="text-xs font-normal text-amber-300">COINS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-800/40'
            }`}
            style={{
              color: activeTab === 'catalog' ? '#FFFFFF' : 'var(--text-secondary)',
              background: activeTab === 'catalog' ? 'var(--accent-primary)' : 'transparent',
            }}
          >
            <Gift className="h-4 w-4" />
            <span>Personal Rewards ({catalog.length})</span>
          </button>

          {isIntegrated && activeGym && (
            <button
              onClick={() => setActiveTab('gym_perks')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === 'gym_perks'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-800/40'
              }`}
              style={{
                color: activeTab === 'gym_perks' ? '#FFFFFF' : 'var(--text-secondary)',
                background: activeTab === 'gym_perks' ? 'var(--accent-primary)' : 'transparent',
              }}
            >
              <Building2 className="h-4 w-4" />
              <span>Club Perks ({gymRewards.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-800/40'
            }`}
            style={{
              color: activeTab === 'history' ? '#FFFFFF' : 'var(--text-secondary)',
              background: activeTab === 'history' ? 'var(--accent-primary)' : 'transparent',
            }}
          >
            <History className="h-4 w-4" />
            <span>Redemption History ({redemptions.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            loadData();
          }}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition"
          style={{
            border: '1px solid var(--border-medium)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
          }}
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        </div>
      ) : activeTab === 'catalog' ? (
        catalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <Gift className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No Rewards Available Right Now</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
              The reward catalog is currently empty. Check back soon for new digital perks and partner discounts!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((item) => {
              const canAfford = balance >= item.coinCost;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl p-5 transition"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        {item.category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1 text-sm font-bold font-mono" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                        <Coins className="h-4 w-4" />
                        <span>{item.coinCost}</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                  </div>

                  <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Available</span>

                    <button
                      onClick={() => setConfirmModalItem(item)}
                      disabled={!canAfford}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition"
                      style={{
                        background: canAfford ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: canAfford ? '#FFFFFF' : 'var(--text-muted)',
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <span>{canAfford ? 'Redeem Perk' : 'Need More Coins'}</span>
                      {canAfford && <ArrowRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'gym_perks' ? (
        <div>
          <div
            className="mb-4 p-4 rounded-xl flex items-start gap-3"
            style={{
              background: 'var(--accent-primary-muted)',
              border: '1px solid var(--accent-primary)',
            }}
          >
            <Building2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--accent-primary)' }}>
                Exclusive Perks for {activeGym?.name} Members
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                These perks are sponsored directly by your integrated club and are unlocked via verified physical check-ins. They are distinct from and do NOT consume your Personal FitCoins balance.
              </p>
            </div>
          </div>

          {gymRewards.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <Building2 className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No Club Perks Active</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your facility management has not published attendance rewards yet. Check back soon or visit the front desk!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gymRewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex flex-col justify-between rounded-xl p-5 transition"
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                        {reward.requiredVisits} Verified Visits
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Attendance Perk
                      </span>
                    </div>
                    <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{reward.title}</h3>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{reward.description}</p>
                  </div>
                  <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Facility Verified</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-success, #10b981)' }}>
                      Claim at Front Desk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : redemptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <History className="mx-auto mb-4 h-12 w-12" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No Redemptions Yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
            When you redeem digital perks with your fitness coins, your redemption codes and history will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {redemptions.map((redemption) => (
            <div
              key={redemption.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl p-4 gap-3 transition"
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{
                    background: 'var(--color-success-muted, rgba(16, 185, 129, 0.12))',
                    color: 'var(--color-success, #10b981)',
                  }}
                >
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {redemption.rewardTitle || 'Redeemed Fitness Perk'}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Redeemed on {new Date(redemption.createdAt).toLocaleDateString()} at{' '}
                    {new Date(redemption.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:self-center">
                {redemption.redemptionCode && (
                  <div
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--border-medium)',
                    }}
                  >
                    <Key className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                    <span>{redemption.redemptionCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 font-mono text-xs font-bold" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                  <span>-{redemption.coinSpent}</span>
                  <Coins className="h-3 w-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Redemption Confirmation Modal */}
      {confirmModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl animate-fade-in"
            style={{
              background: 'var(--bg-surface-elevated, var(--bg-surface))',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Confirm Redemption</h3>
              <button
                onClick={() => setConfirmModalItem(null)}
                className="rounded-lg p-1 transition"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Are you sure you want to redeem <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{confirmModalItem.title}</span>?
              </p>

              <div
                className="rounded-lg p-3 text-xs space-y-1.5"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                  <span>Current Balance:</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{balance} coins</span>
                </div>
                <div className="flex justify-between font-semibold" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                  <span>Cost:</span>
                  <span className="font-mono">-{confirmModalItem.coinCost} coins</span>
                </div>
                <div className="flex justify-between pt-1.5 font-bold" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                  <span>Remaining Balance:</span>
                  <span className="font-mono" style={{ color: 'var(--color-success, #10b981)' }}>
                    {balance - confirmModalItem.coinCost} coins
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalItem(null)}
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition"
                style={{
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={redeeming}
                onClick={handleRedeem}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition"
                style={{
                  background: 'var(--accent-primary)',
                  color: '#FFFFFF',
                  opacity: redeeming ? 0.6 : 1,
                  boxShadow: 'var(--shadow-sm)',
                }}
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
