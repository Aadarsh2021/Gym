import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  X,
  ShieldCheck,
  Dumbbell,
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Hourglass,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  gymHistoryService,
  GymAttendanceSummaryResult,
  formatFriendlyDuration,
} from '@/services/gym-history.service';
import { gymCheckoutService } from '@/services/gym-checkout.service';
import { gymRepository } from '@/repositories/gym.repository';
import {
  GymAttendanceSession,
  Gym,
  GymAttendanceStreak,
  GymReward,
  GymRewardRedemption,
} from '@/types/gym.types';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { formatVisitDateIST, formatVisitTimeIST } from '@/utils/date';
import { formatDate } from '@/utils/formatters';
import { Flame, Award, Gift, Ticket } from 'lucide-react';

export const MemberGymHistoryView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || '';

  // Data states
  const [summary, setSummary] = useState<GymAttendanceSummaryResult | null>(null);
  const [sessions, setSessions] = useState<(GymAttendanceSession & { gym?: Gym })[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<{
    session: GymAttendanceSession;
    gym?: Gym;
  } | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const limit = 20;

  // Visit details modal state
  const [selectedVisit, setSelectedVisit] = useState<
    (GymAttendanceSession & { gym?: Gym }) | null
  >(null);

  // Phase G1: Gym Streak & Rewards state
  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymCtx = useMemberGymContext();
  } catch {
    // Standalone test fallback
  }

  const [gymStreak, setGymStreak] = useState<GymAttendanceStreak | null>(null);
  const [rewards, setRewards] = useState<GymReward[]>([]);
  const [redemptions, setRedemptions] = useState<GymRewardRedemption[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<GymRewardRedemption | null>(null);

  // Fetch initial summary and history
  const loadData = useCallback(async () => {
    if (!userId || userId === 'guest-user') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch summary metrics computed at database layer
      const summaryPromise = gymHistoryService.getAttendanceSummary(userId);

      // 2. Fetch first page of history
      const historyPromise = gymHistoryService.getAttendanceHistory(userId, {
        limit,
        offset: 0,
      });

      // 3. Check for any active attendance session
      const activePromise = gymCheckoutService.getActiveSession(userId);

      const [summaryRes, historyRes, activeRes] = await Promise.all([
        summaryPromise,
        historyPromise,
        activePromise,
      ]);

      setSummary(summaryRes);
      setSessions(historyRes.sessions);
      setHasMore(historyRes.hasMore);
      setOffset(historyRes.sessions.length);

      if (activeRes.session) {
        setActiveSession({
          session: activeRes.session,
          gym: activeRes.gym || undefined,
        });
      } else {
        setActiveSession(null);
      }

      // 4. Phase G1: Load Gym Attendance Streak & Rewards for active gym
      const targetGymId = memberGymCtx?.activeGym?.id || historyRes.sessions[0]?.gymId;
      if (targetGymId) {
        const [streakData, rewardsData, redemptionsData] = await Promise.all([
          gymRepository.getGymAttendanceStreak(targetGymId, userId),
          gymRepository.fetchGymRewards(targetGymId),
          gymRepository.fetchMemberRedemptions(userId, targetGymId),
        ]);
        setGymStreak(streakData);
        setRewards(rewardsData);
        setRedemptions(redemptionsData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load attendance history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [userId, memberGymCtx?.activeGym?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClaimReward = async (rewardId: string) => {
    if (!userId || claimingId) return;
    try {
      setClaimingId(rewardId);
      setError(null);
      setClaimSuccessMsg(null);
      const res = await gymRepository.claimGymReward(rewardId, userId);
      if (!res.success || !res.redemption) {
        setError(res.error || 'Failed to claim milestone perk');
        return;
      }
      setSelectedTicket(res.redemption);
      setClaimSuccessMsg('Perk claimed successfully! Show verification code at reception.');
      await loadData();
    } catch {
      setError('An error occurred while claiming reward');
    } finally {
      setClaimingId(null);
    }
  };

  // Load more pages
  const handleLoadMore = async () => {
    if (!userId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const res = await gymHistoryService.getAttendanceHistory(userId, {
        limit,
        offset,
      });

      setSessions(prev => [...prev, ...res.sessions]);
      setHasMore(res.hasMore);
      setOffset(prev => prev + res.sessions.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load more visits';
      setError(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Inspect visit details
  const handleInspectVisit = async (visitItem: GymAttendanceSession & { gym?: Gym }) => {
    try {
      const res = await gymHistoryService.getVisitDetails(visitItem.id, userId);
      if (res.success && res.visit) {
        setSelectedVisit(res.visit);
      } else {
        // Fallback to item in hand if network or query hit a snag
        setSelectedVisit(visitItem);
      }
    } catch {
      setSelectedVisit(visitItem);
    }
  };

  // Format method labels
  const formatMethod = (method: string | null | undefined) => {
    switch (method) {
      case 'manual_button':
        return 'Manual';
      case 'qr_scan':
        return 'QR Scan';
      case 'gps_geofence':
        return 'GPS';
      case 'auto_timeout':
        return 'Auto';
      case 'reception_manual':
        return 'Staff';
      default:
        return 'Standard';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/app/gym"
              className="inline-flex items-center text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Gym
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-500" />
              Attendance History
            </h1>
            <p className="text-sm text-slate-400">
              Verified records of your completed workouts and facility visits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-2 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Refresh attendance records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              to="/app/gym/check-in"
              className="px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Dumbbell className="w-4 h-4" />
              Check In
            </Link>
          </div>
        </div>

        {/* Active Session Notice Banner */}
        {activeSession && (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Hourglass className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-200">
                  Active Visit in Progress: {activeSession.gym?.name || 'Partner Gym'}
                </h4>
                <p className="text-xs text-blue-300/80">
                  Started at {formatVisitTimeIST(activeSession.session.checkInAt)}. This visit will
                  appear in your history once checked out.
                </p>
              </div>
            </div>
            <Link
              to="/app/gym/check-in"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              Check Out Now
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/30 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Failed to load history</p>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="text-xs text-red-400 hover:text-red-200 underline font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Phase G1: Gym Attendance Streak Banner */}
        <div
          className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
              <Flame className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  GYM STREAK
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                  Facility-Local
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white">
                  {gymStreak?.currentStreak ?? 0} {gymStreak?.currentStreak === 1 ? 'Day' : 'Days'}
                </span>
                <span className="text-xs text-slate-400">
                  (Best: {gymStreak?.longestStreak ?? 0} Days)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Consecutive facility attendance. Separate from your personal workout streak.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
            <div className="text-left md:text-right">
              <span className="text-xs text-slate-400 block">Total Facility Visits</span>
              <span className="text-lg sm:text-xl font-bold text-amber-300">
                {gymStreak?.totalVisitDays ?? (summary?.totalVisits ?? 0)} Days
              </span>
            </div>
          </div>
        </div>

        {/* Feature 3: Attendance Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Completed Visits */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Visits</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            {isLoading && !summary ? (
              <div className="h-7 w-16 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary?.totalVisits ?? 0}
              </div>
            )}
            <p className="text-[11px] text-slate-500">Completed workouts</p>
          </div>

          {/* Card 2: Total Time Spent */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Time</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            {isLoading && !summary ? (
              <div className="h-7 w-24 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary?.totalDurationFormatted ?? '0 mins'}
              </div>
            )}
            <p className="text-[11px] text-slate-500">Cumulative verified</p>
          </div>

          {/* Card 3: Average Visit Duration */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Average Duration</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            {isLoading && !summary ? (
              <div className="h-7 w-20 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary?.averageDurationFormatted ?? '0 mins'}
              </div>
            )}
            <p className="text-[11px] text-slate-500">Per gym visit</p>
          </div>

          {/* Card 4: Current Month Completed Visits */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>This Month (IST)</span>
              <Calendar className="w-4 h-4 text-purple-400" />
            </div>
            {isLoading && !summary ? (
              <div className="h-7 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary?.currentMonthVisits ?? 0}
              </div>
            )}
            <p className="text-[11px] text-slate-500">Current calendar month</p>
          </div>
        </div>

        {/* Phase G1: Gym Milestone Perks */}
        {rewards.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Gym Milestone Perks</span>
              </h2>
              <span className="text-xs text-slate-400">
                Earned through verified physical attendance
              </span>
            </div>

            {claimSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{claimSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {rewards.map(reward => {
                const uniqueVisits = gymStreak?.totalVisitDays ?? (summary?.totalVisits ?? 0);
                const isEligible = uniqueVisits >= reward.requiredVisits;
                const redemption = redemptions.find(r => r.rewardId === reward.id);
                const isClaimed = !!redemption;
                const isRedeemed = redemption?.status === 'redeemed';
                const progressPct = Math.min(100, Math.round((uniqueVisits / reward.requiredVisits) * 100));

                return (
                  <div
                    key={reward.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">
                          {reward.requiredVisits} Visits Milestone
                        </span>
                        {isRedeemed ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                            ✓ Redeemed
                          </span>
                        ) : isClaimed ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                            ⏳ Ready at Desk
                          </span>
                        ) : isEligible ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                            Unlocked!
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {reward.requiredVisits - uniqueVisits} to go
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-white">{reward.title}</h3>
                      {reward.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{reward.description}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {isClaimed && redemption ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(redemption)}
                          className="w-full py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-500/30 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>View Code: {redemption.redemptionCode}</span>
                        </button>
                      ) : isEligible ? (
                        <button
                          type="button"
                          onClick={() => handleClaimReward(reward.id)}
                          disabled={claimingId === reward.id}
                          className="w-full py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {claimingId === reward.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Gift className="w-3.5 h-3.5" />
                          )}
                          <span>Claim Perk</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 text-xs text-slate-500 bg-slate-800/40 rounded-lg cursor-not-allowed"
                        >
                          {uniqueVisits} / {reward.requiredVisits} Visits
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature 1: Attendance History Feed */}
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <span>Completed Gym Visits</span>
            {sessions.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full font-normal">
                {sessions.length} recorded
              </span>
            )}
          </h2>

          {/* Loading Skeletons */}
          {isLoading && sessions.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between animate-pulse"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-slate-800 rounded" />
                    <div className="h-3 w-56 bg-slate-800/60 rounded" />
                  </div>
                  <div className="h-6 w-20 bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && sessions.length === 0 && (
            <div className="p-8 sm:p-12 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="w-7 h-7 text-slate-500" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  No gym visits recorded yet
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  When you check in and complete workouts at your gym, your verified visits and
                  stats will appear here.
                </p>
              </div>
              <div>
                <Link
                  to="/app/gym/check-in"
                  className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors gap-2"
                >
                  <Dumbbell className="w-4 h-4" />
                  Check In for Workout
                </Link>
              </div>
            </div>
          )}

          {/* Sessions List */}
          {sessions.length > 0 && (
            <div className="space-y-2.5">
              {sessions.map(s => {
                const facilityName = s.gym?.name || 'Verified Gym';
                const formattedDate = formatVisitDateIST(s.checkInAt);
                const checkInTime = formatVisitTimeIST(s.checkInAt);
                const checkOutTime = s.checkOutAt ? formatVisitTimeIST(s.checkOutAt) : '—';
                const duration = formatFriendlyDuration(s.durationSeconds);
                const methodBadge = formatMethod(s.checkoutMethod);

                return (
                  <div
                    key={s.id}
                    onClick={() => handleInspectVisit(s)}
                    className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {facilityName}
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                          {methodBadge}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span className="text-slate-300">{formattedDate}</span>
                        <span>•</span>
                        <span>
                          {checkInTime} – {checkOutTime}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800/80">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-bold text-white flex items-center sm:justify-end gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{duration}</span>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-medium">Completed</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination: Load More */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-5 py-2.5 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading More Visits...
                  </>
                ) : (
                  <>
                    <span>Load More Visits</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Feature 2: Attendance Visit Details Modal */}
        {selectedVisit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedVisit(null)}
          >
            <div
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl text-left"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Attendance Record
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedVisit.gym?.name || 'Verified Gym Facility'}
                  </h3>
                  {selectedVisit.gym?.address && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {selectedVisit.gym.address}
                      {selectedVisit.gym.city ? `, ${selectedVisit.gym.city}` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Telemetry Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">Date</span>
                  <p className="text-xs font-medium text-white mt-0.5">
                    {formatVisitDateIST(selectedVisit.checkInAt)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">Status</span>
                  <p className="text-xs font-semibold text-emerald-400 mt-0.5 capitalize">
                    {selectedVisit.status}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Check-In Time
                  </span>
                  <p className="text-xs font-medium text-white mt-0.5">
                    {formatVisitTimeIST(selectedVisit.checkInAt)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Check-Out Time
                  </span>
                  <p className="text-xs font-medium text-white mt-0.5">
                    {selectedVisit.checkOutAt
                      ? formatVisitTimeIST(selectedVisit.checkOutAt)
                      : '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Total Duration
                  </span>
                  <p className="text-xs font-bold text-blue-400 mt-0.5">
                    {formatFriendlyDuration(selectedVisit.durationSeconds)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    ({selectedVisit.durationSeconds || 0} seconds)
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Verification Method
                  </span>
                  <p className="text-xs font-medium text-slate-300 mt-0.5">
                    {formatMethod(selectedVisit.verificationMethod)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Checkout Method
                  </span>
                  <p className="text-xs font-medium text-slate-300 mt-0.5">
                    {formatMethod(selectedVisit.checkoutMethod)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Session ID
                  </span>
                  <p className="text-[11px] font-mono text-slate-300 mt-0.5 truncate" title={selectedVisit.id}>
                    {selectedVisit.id}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase G1: Redemption Ticket Modal */}
        {selectedTicket && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedTicket(null)}
          >
            <div
              className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Milestone Perk Ticket</h3>
                    <p className="text-xs text-slate-400">Present to staff at gym reception</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                  Authoritative Verification Code
                </span>
                <div className="py-3 px-4 bg-slate-900 rounded-lg border border-amber-500/40 inline-block">
                  <code className="text-2xl sm:text-3xl font-mono font-extrabold tracking-widest text-amber-400">
                    {selectedTicket.redemptionCode}
                  </code>
                </div>
                <p className="text-[11px] text-slate-500">
                  Status: <span className="font-semibold text-amber-300 uppercase">{selectedTicket.status}</span> • Claimed on {formatDate(selectedTicket.claimedAt)}
                </p>
              </div>

              <div className="text-center text-xs text-slate-400">
                Gym reception will inspect this code on their dashboard to mark your perk fulfilled.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-full py-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default MemberGymHistoryView;
