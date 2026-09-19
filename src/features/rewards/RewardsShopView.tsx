import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { rewardsService } from '@/services/rewards.service';
import { FitnessRewardItem, FitnessRewardRedemption } from '@/types/rewards.types';
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
} from 'lucide-react';

export const RewardsShopView: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id || '';

  const [balance, setBalance] = useState<number>(0);
  const [catalog, setCatalog] = useState<FitnessRewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<FitnessRewardRedemption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  const [confirmModalItem, setConfirmModalItem] = useState<FitnessRewardItem | null>(null);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [bal, items, history] = await Promise.all([
        rewardsService.getBalance(),
        rewardsService.getCatalog(),
        rewardsService.getRedemptions(userId),
      ]);
      setBalance(bal.balance);
      setCatalog(items);
      setRedemptions(history);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load rewards shop');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

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
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Gift className="h-4 w-4" />
            <span>Rewards Catalog ({catalog.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : activeTab === 'catalog' ? (
        catalog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
            <Gift className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h3 className="text-base font-semibold text-slate-200">No Rewards Available Right Now</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
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
                  className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-300">
                        {item.category.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1 text-sm font-bold font-mono text-amber-400">
                        <Coins className="h-4 w-4" />
                        <span>{item.coinCost}</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1.5">{item.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Available</span>

                    <button
                      onClick={() => setConfirmModalItem(item)}
                      disabled={!canAfford}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                        canAfford
                          ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                      }`}
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
      ) : redemptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <History className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">No Redemptions Yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            When you redeem digital perks with your fitness coins, your redemption codes and history will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {redemptions.map((redemption) => (
            <div
              key={redemption.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {redemption.rewardTitle || 'Redeemed Fitness Perk'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Redeemed on {new Date(redemption.createdAt).toLocaleDateString()} at{' '}
                    {new Date(redemption.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:self-center">
                {redemption.redemptionCode && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-xs text-blue-400 border border-slate-700">
                    <Key className="h-3 w-3 text-slate-400" />
                    <span>{redemption.redemptionCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Confirm Redemption</h3>
              <button
                onClick={() => setConfirmModalItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-300">
                Are you sure you want to redeem <span className="font-bold text-white">{confirmModalItem.title}</span>?
              </p>

              <div className="rounded-lg bg-slate-800/80 p-3 text-xs space-y-1.5 border border-slate-700">
                <div className="flex justify-between text-slate-400">
                  <span>Current Balance:</span>
                  <span className="font-mono text-white">{balance} coins</span>
                </div>
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>Cost:</span>
                  <span className="font-mono">-{confirmModalItem.coinCost} coins</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-slate-700 pt-1.5 font-bold">
                  <span>Remaining Balance:</span>
                  <span className="font-mono text-emerald-400">
                    {balance - confirmModalItem.coinCost} coins
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalItem(null)}
                className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={redeeming}
                onClick={handleRedeem}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-sm"
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
