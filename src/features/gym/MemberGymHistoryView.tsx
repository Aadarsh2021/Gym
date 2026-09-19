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
      const summaryPromise = gymHistoryService.getAttendanceSummary(userId);
      const historyPromise = gymHistoryService.getAttendanceHistory(userId, { limit, offset: 0 });
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
        setActiveSession({ session: activeRes.session, gym: activeRes.gym || undefined });
      } else {
        setActiveSession(null);
      }

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

  useEffect(() => { loadData(); }, [loadData]);

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
      setClaimSuccessMsg('Perk claimed! Show verification code at reception.');
      await loadData();
    } catch {
      setError('An error occurred while claiming reward');
    } finally {
      setClaimingId(null);
    }
  };

  const handleLoadMore = async () => {
    if (!userId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await gymHistoryService.getAttendanceHistory(userId, { limit, offset });
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

  const handleInspectVisit = async (visitItem: GymAttendanceSession & { gym?: Gym }) => {
    try {
      const res = await gymHistoryService.getVisitDetails(visitItem.id, userId);
      if (res.success && res.visit) {
        setSelectedVisit(res.visit);
      } else {
        setSelectedVisit(visitItem);
      }
    } catch {
      setSelectedVisit(visitItem);
    }
  };

  const formatMethod = (method: string | null | undefined) => {
    switch (method) {
      case 'manual_button': return 'Manual';
      case 'qr_scan': return 'QR Scan';
      case 'gps_geofence': return 'GPS';
      case 'auto_timeout': return 'Auto';
      case 'reception_manual': return 'Staff';
      default: return 'Standard';
    }
  };

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link
          to="/app/gym"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 'var(--space-2)', transition: 'color var(--transition-fast)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ArrowLeft size={14} /> Back to Gym
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-1)' }}>
              <Calendar size={14} /> Attendance History
            </div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>Gym Visit Log</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Verified records of your completed workouts and facility visits.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="btn btn-secondary btn-sm"
              title="Refresh attendance records"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link to="/app/gym/check-in" className="btn btn-primary btn-sm">
              <Dumbbell size={14} /> Check In
            </Link>
          </div>
        </div>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(79, 140, 255, 0.35)',
            background: 'rgba(79, 140, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(79, 140, 255, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-primary)', flexShrink: 0,
              }}
            >
              <Hourglass size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Active Visit: {activeSession.gym?.name || 'Partner Gym'}
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Started at {formatVisitTimeIST(activeSession.session.checkInAt)}. Appears here after checkout.
              </p>
            </div>
          </div>
          <Link to="/app/gym/check-in" className="btn btn-primary btn-sm">
            Check Out <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--color-error)', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Streak Banner */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-4)',
          background: 'linear-gradient(135deg, rgba(214, 168, 79, 0.08) 0%, var(--bg-surface) 60%)',
          border: '1px solid rgba(214, 168, 79, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-muted)', border: '1px solid rgba(79, 140, 255, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-primary)', flexShrink: 0,
            }}
          >
            <Flame size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)', marginBottom: '2px' }}>
              GYM STREAK
              <span className="badge" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>Facility-Local</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
                {gymStreak?.currentStreak ?? 0}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {gymStreak?.currentStreak === 1 ? 'Day' : 'Days'}
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.8rem' }}>
                  (Best: {gymStreak?.longestStreak ?? 0})
                </span>
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Consecutive facility attendance — separate from workout streak.
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total Facility Visits</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
            {gymStreak?.totalVisitDays ?? (summary?.totalVisits ?? 0)} Days
          </span>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {[
          { label: 'Total Visits', value: summary?.totalVisits ?? 0, sub: 'Completed workouts', icon: <CheckCircle2 size={16} color="var(--color-success)" /> },
          { label: 'Total Time', value: summary?.totalDurationFormatted ?? '0 mins', sub: 'Cumulative verified', icon: <Clock size={16} color="var(--accent-primary)" /> },
          { label: 'Avg Duration', value: summary?.averageDurationFormatted ?? '0 mins', sub: 'Per gym visit', icon: <TrendingUp size={16} color="var(--color-info)" /> },
          { label: 'This Month', value: summary?.currentMonthVisits ?? 0, sub: 'Current calendar month', icon: <Calendar size={16} color="var(--accent-indigo)" /> },
        ].map(stat => (
          <div key={stat.label} className="stat-tile">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="label">{stat.label}</span>
              {stat.icon}
            </div>
            {isLoading && !summary ? (
              <div style={{ height: '28px', width: '80px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-xs)', marginTop: '4px' }} />
            ) : (
              <span className="value">{stat.value}</span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Milestone Perks */}
      {rewards.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <Award size={18} color="var(--accent-primary)" /> Gym Milestone Perks
            </h3>
            <small style={{ color: 'var(--text-muted)' }}>Earned through verified physical attendance</small>
          </div>

          {claimSuccessMsg && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--color-success)', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <CheckCircle2 size={15} /> {claimSuccessMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
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
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--space-3)' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {reward.requiredVisits} Visits Milestone
                      </span>
                      {isRedeemed ? (
                        <span className="badge badge-success">✓ Redeemed</span>
                      ) : isClaimed ? (
                        <span className="badge badge-warning">⏳ At Desk</span>
                      ) : isEligible ? (
                        <span className="badge badge-accent">Unlocked!</span>
                      ) : (
                        <span className="badge">{reward.requiredVisits - uniqueVisits} to go</span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>{reward.title}</h4>
                    {reward.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {reward.description}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Progress bar */}
                    <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                      <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--accent-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
                    </div>

                    {isClaimed && redemption ? (
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(redemption)}
                        className="btn btn-secondary btn-sm btn-block"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        <Ticket size={13} /> View Code: {redemption.redemptionCode}
                      </button>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={claimingId === reward.id}
                        className="btn btn-primary btn-sm btn-block"
                      >
                        {claimingId === reward.id ? <RefreshCw size={12} className="animate-spin" /> : <Gift size={13} />}
                        Claim Perk
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="btn btn-ghost btn-sm btn-block"
                        style={{ cursor: 'not-allowed', opacity: 0.5 }}
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

      {/* Completed Gym Visits */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Building2 size={18} color="var(--accent-primary)" /> Completed Gym Visits
          {sessions.length > 0 && (
            <span className="badge" style={{ marginLeft: '4px' }}>{sessions.length} recorded</span>
          )}
        </h3>

        {/* Loading Skeletons */}
        {isLoading && sessions.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.5 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ height: '14px', width: '180px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-xs)' }} />
                  <div style={{ height: '11px', width: '240px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-xs)', opacity: 0.6 }} />
                </div>
                <div style={{ height: '22px', width: '80px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-xs)' }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sessions.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <div
              style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'var(--bg-input)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--text-muted)',
              }}
            >
              <Calendar size={26} />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>No gym visits recorded yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto var(--space-5)' }}>
              When you check in and complete workouts at your gym, your verified visits and stats will appear here.
            </p>
            <Link to="/app/gym/check-in" className="btn btn-primary">
              <Dumbbell size={15} /> Check In for Workout
            </Link>
          </div>
        )}

        {/* Sessions List */}
        {sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                  className="card card-interactive"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                      <Building2 size={14} color="var(--text-muted)" />
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {facilityName}
                      </h4>
                      <span className="badge" style={{ fontSize: '0.68rem', flexShrink: 0 }}>{methodBadge}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{formattedDate}</span>
                      <span>•</span>
                      <span>{checkInTime} – {checkOutTime}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.9rem' }}>
                        <Clock size={13} color="var(--accent-primary)" /> {duration}
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 600 }}>Completed</p>
                    </div>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div style={{ textAlign: 'center', paddingTop: 'var(--space-4)' }}>
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="btn btn-secondary"
            >
              {isLoadingMore ? (
                <><RefreshCw size={14} className="animate-spin" /> Loading More...</>
              ) : (
                <>Load More Visits <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      {selectedVisit && (
        <div className="modal-backdrop" onClick={() => setSelectedVisit(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: 'var(--space-2)' }}>
                  <ShieldCheck size={12} /> Verified Attendance Record
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {selectedVisit.gym?.name || 'Verified Gym Facility'}
                </h3>
                {selectedVisit.gym?.address && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <MapPin size={11} /> {selectedVisit.gym.address}{selectedVisit.gym.city ? `, ${selectedVisit.gym.city}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedVisit(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '6px', minHeight: 'unset' }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)',
                padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                marginBottom: 'var(--space-5)',
              }}
            >
              {[
                { label: 'Date', value: formatVisitDateIST(selectedVisit.checkInAt) },
                { label: 'Status', value: selectedVisit.status, accent: 'var(--color-success)' },
                { label: 'Check-In Time', value: formatVisitTimeIST(selectedVisit.checkInAt) },
                { label: 'Check-Out Time', value: selectedVisit.checkOutAt ? formatVisitTimeIST(selectedVisit.checkOutAt) : '—' },
                { label: 'Total Duration', value: formatFriendlyDuration(selectedVisit.durationSeconds), accent: 'var(--accent-primary)' },
                { label: 'Verification', value: formatMethod(selectedVisit.verificationMethod) },
                { label: 'Checkout Method', value: formatMethod(selectedVisit.checkoutMethod) },
                { label: 'Session ID', value: selectedVisit.id.slice(0, 12) + '…', mono: true },
              ].map(row => (
                <div key={row.label}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
                    {row.label}
                  </span>
                  <p
                    style={{
                      fontSize: '0.82rem', fontWeight: 600,
                      color: row.accent || 'var(--text-primary)',
                      fontFamily: row.mono ? 'var(--font-mono)' : undefined,
                      textTransform: row.label === 'Status' ? 'capitalize' : undefined,
                    }}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedVisit(null)} className="btn btn-secondary btn-block">Close</button>
          </div>
        </div>
      )}

      {/* Redemption Ticket Modal */}
      {selectedTicket && (
        <div className="modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ticket size={20} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Milestone Perk Ticket</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Present to staff at gym reception</p>
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="btn btn-ghost btn-sm" style={{ padding: '6px', minHeight: 'unset' }}>
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                padding: 'var(--space-5)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-3)' }}>
                Authoritative Verification Code
              </span>
              <code
                style={{
                  fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 900,
                  letterSpacing: '0.2em', color: 'var(--accent-primary)', display: 'block',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {selectedTicket.redemptionCode}
              </code>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Status: <strong style={{ color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{selectedTicket.status}</strong>
                {' '}• Claimed on {formatDate(selectedTicket.claimedAt)}
              </p>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Gym reception will inspect this code on their dashboard to mark your perk fulfilled.
            </p>
            <button onClick={() => setSelectedTicket(null)} className="btn btn-secondary btn-block">Done</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default MemberGymHistoryView;
