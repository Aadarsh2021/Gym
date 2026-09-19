import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { ownerDashboardService } from '@/services/owner-dashboard.service';
import { GymAttendanceSession } from '@/types/gym.types';
import { OwnerDashboardOverview } from '@/types/owner-dashboard.types';
import { formatFriendlyDuration } from '@/services/gym-history.service';
import { formatVisitDateIST, formatVisitTimeIST } from '@/utils/date';
import {
  Building2,
  Users,
  Clock,
  MapPin,
  PlusCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  Calendar,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  History,
  AlertTriangle,
  ShieldAlert,
  Flame,
  BarChart2,
  Trophy,
  MessageSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerDashboardView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  // Tab mode: 'floor' | 'ledger'
  const [activeTab, setActiveTab] = useState<'floor' | 'ledger'>('floor');

  // G7 Operations Intelligence Overview State
  const [overview, setOverview] = useState<OwnerDashboardOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Live Floor State
  const [activeSessions, setActiveSessions] = useState<GymAttendanceSession[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [todayCheckins, setTodayCheckins] = useState<number>(0);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Completed Ledger State
  const [historySessions, setHistorySessions] = useState<GymAttendanceSession[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState<number>(0);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const historyPageSize = 15;

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update live elapsed duration ticker every 30 seconds
  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(ticker);
  }, []);

  // 1. Fetch Operations Intelligence Overview (G7)
  const fetchOverview = useCallback(async () => {
    if (!activeGym?.id) return;
    try {
      const data = await ownerDashboardService.getOverview(activeGym.id);
      if (!isMountedRef.current) return;
      if (data) {
        setOverview(data);
        setLastRefreshed(new Date());
      }
    } catch {
      // Graceful fallback to floor sync metrics
    } finally {
      if (isMountedRef.current) {
        setLoadingOverview(false);
      }
    }
  }, [activeGym?.id]);

  // 2. Fetch live floor metrics
  const fetchLiveMetrics = useCallback(
    async (isManualRefresh = false) => {
      if (!activeGym) {
        setLoadingMetrics(false);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      try {
        const res = await ownerDashboardService.getFloorSync(activeGym.id);
        if (!isMountedRef.current) return;

        setActiveSessions(res.activeSessions);
        setTodayCheckins(res.todayCheckins);
        setMemberCount(res.memberCounts.active);
      } catch {
        // Fallback gracefully
      } finally {
        if (isMountedRef.current) {
          setLoadingMetrics(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeGym]
  );

  // 3. Fetch completed attendance ledger
  const fetchHistoryLedger = useCallback(async () => {
    if (!activeGym) return;
    setHistoryLoading(true);

    try {
      const offset = (historyPage - 1) * historyPageSize;
      const res = await ownerDashboardService.getCompletedAttendanceLedger(activeGym.id, {
        limit: historyPageSize,
        offset,
        search: searchQuery.trim() || undefined,
        startDateIso: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
        endDateIso: endDateFilter ? new Date(endDateFilter + 'T23:59:59.999Z').toISOString() : undefined,
      });

      if (!isMountedRef.current) return;
      setHistorySessions(res.sessions);
      setHistoryTotalCount(res.totalCount);
    } catch {
      if (isMountedRef.current) {
        setHistorySessions([]);
        setHistoryTotalCount(0);
      }
    } finally {
      if (isMountedRef.current) {
        setHistoryLoading(false);
      }
    }
  }, [activeGym, historyPage, searchQuery, startDateFilter, endDateFilter]);

  // Initial load and polling sync (every 20s for active floor, 30s for overview with visibility check)
  useEffect(() => {
    fetchOverview();
    fetchLiveMetrics();

    // 20s live floor poll
    const floorPoll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLiveMetrics();
      }
    }, 20000);

    // 30s overview poll (respects document visibility)
    const overviewPoll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOverview();
      }
    }, 30000);

    // Refresh immediately when tab returns to visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOverview();
        fetchLiveMetrics();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(floorPoll);
      clearInterval(overviewPoll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchOverview, fetchLiveMetrics]);

  // Load history ledger when switched to 'ledger' or when filters change
  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchHistoryLedger();
    }
  }, [activeTab, fetchHistoryLedger]);

  // Unified manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchOverview(),
      fetchLiveMetrics(true),
      activeTab === 'ledger' ? fetchHistoryLedger() : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  };

  if (loadingGym) {
    return (
      <div
        className="container animate-fade-in"
        style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Loading facility console...
        </div>
      </div>
    );
  }

  // 1. OWNER WITHOUT A GYM
  if (!activeGym) {
    return (
      <div
        className="container animate-fade-in"
        style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '900px' }}
      >
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-10) var(--space-6)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(214, 168, 79, 0.15)',
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <Building2 size={32} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            No Gym Registered Yet
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              maxWidth: '480px',
              margin: '0 auto var(--space-6)',
              lineHeight: 1.5,
            }}
          >
            To begin managing your facility, monitoring live gym attendance, and configuring member
            check-ins, register your gym location.
          </p>

          <Link
            to="/owner/onboarding"
            className="btn btn-primary btn-md"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #D6A84F 0%, #B8860B 100%)',
              color: '#000000',
              fontWeight: 700,
            }}
          >
            <PlusCircle size={18} />
            <span>Create Your Gym</span>
          </Link>
        </div>
      </div>
    );
  }

  // Format method labels
  const formatMethod = (method: string | null | undefined) => {
    switch (method) {
      case 'qr_scan':
        return 'QR Scan';
      case 'gps_geofence':
        return 'GPS Perimeter';
      case 'manual_button':
        return 'Manual';
      case 'auto_timeout':
        return 'Auto';
      case 'reception_manual':
        return 'Staff Desk';
      default:
        return 'Standard';
    }
  };

  const totalHistoryPages = Math.max(1, Math.ceil(historyTotalCount / historyPageSize));

  // Resolved overview data with fallbacks
  const currentOccupancy = overview ? overview.live.occupancy : activeSessions.length;
  const maxCapacity = overview ? overview.facility.maxCapacity : 100;
  const occupancyRate = overview
    ? overview.live.occupancyRate
    : Math.min(100, Math.round((currentOccupancy / maxCapacity) * 100));
  const facilityStatus = overview ? overview.live.status : occupancyRate >= 100 ? 'at_capacity' : occupancyRate >= 80 ? 'crowded' : 'normal';

  const pendingMembers = overview?.members.pendingMembershipsCount || 0;
  const unresolvedFlags = overview?.moderation.unresolvedFlagsCount || 0;
  const openIncidents = overview?.safety.openSafetyIncidentsCount || 0;
  const criticalIncidents = overview?.safety.criticalSafetyIncidentsCount || 0;
  const hasActionItems = pendingMembers > 0 || unresolvedFlags > 0 || openIncidents > 0;

  // Max peak check-ins for relative chart scaling
  const peakDistribution = overview?.attendance.peakHoursDistribution || [];
  const maxPeakCheckins = Math.max(1, ...peakDistribution.map(b => b.checkins));

  // 2. OWNER WITH ACTIVE GYM — Operations Intelligence Dashboard
  return (
    <div
      className="container animate-fade-in"
      style={{ padding: 'var(--space-6) var(--space-4)', maxWidth: '1200px' }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--accent-gold)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: 'var(--space-1)',
            }}
          >
            <Building2 size={16} />
            <span>OPERATIONS INTELLIGENCE</span>
            <span style={{ color: 'var(--border-subtle)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>
              TZ: {overview?.facility.timezone || activeGym.timezone || 'Asia/Kolkata'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>{activeGym.name}</h1>
            {/* Facility Status Badge */}
            <span
              className="badge"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background:
                  facilityStatus === 'at_capacity'
                    ? 'rgba(239, 68, 68, 0.18)'
                    : facilityStatus === 'crowded'
                    ? 'rgba(234, 179, 8, 0.18)'
                    : 'rgba(34, 197, 94, 0.18)',
                color:
                  facilityStatus === 'at_capacity'
                    ? '#ef4444'
                    : facilityStatus === 'crowded'
                    ? '#eab308'
                    : '#22c55e',
                border: `1px solid ${
                  facilityStatus === 'at_capacity'
                    ? 'rgba(239, 68, 68, 0.4)'
                    : facilityStatus === 'crowded'
                    ? 'rgba(234, 179, 8, 0.4)'
                    : 'rgba(34, 197, 94, 0.4)'
                }`,
              }}
            >
              {facilityStatus === 'at_capacity'
                ? 'At Capacity'
                : facilityStatus === 'crowded'
                ? 'Crowded (80%+)'
                : 'Normal Operations'}
            </span>
          </div>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              marginBottom: 0,
            }}
          >
            <MapPin size={14} />
            <span>
              {activeGym.address}, {activeGym.city}
            </span>
            {lastRefreshed && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <span style={{ fontSize: '0.8rem' }}>
                  Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || historyLoading || loadingOverview}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh operations overview and floor data"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing || historyLoading || loadingOverview ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Refresh</span>
          </button>
          <Link
            to="/owner/profile"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Edit Facility</span>
          </Link>
          <Link
            to="/owner/onboarding"
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)' }}
          >
            <PlusCircle size={15} />
            <span>Add Gym</span>
          </Link>
        </div>
      </div>

      {/* OPERATIONAL ACTION HUB (Only visible when actions are pending) */}
      {hasActionItems && (
        <div
          className="card card-elevated animate-fade-in"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: criticalIncidents > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(234, 179, 8, 0.08)',
            border: `1px solid ${criticalIncidents > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
            marginBottom: 'var(--space-6)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {criticalIncidents > 0 ? (
                <ShieldAlert size={20} style={{ color: '#ef4444' }} />
              ) : (
                <AlertTriangle size={20} style={{ color: '#eab308' }} />
              )}
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Operational Actions Requiring Attention
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  {criticalIncidents > 0 && `${criticalIncidents} critical incident${criticalIncidents > 1 ? 's' : ''} • `}
                  {pendingMembers > 0 && `${pendingMembers} pending member${pendingMembers > 1 ? 's' : ''} • `}
                  {unresolvedFlags > 0 && `${unresolvedFlags} flagged post${unresolvedFlags > 1 ? 's' : ''} • `}
                  {openIncidents > 0 && `${openIncidents} open safety ticket${openIncidents > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {pendingMembers > 0 && (
                <Link
                  to="/owner/members"
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Users size={13} />
                  <span>Review {pendingMembers} Pending</span>
                </Link>
              )}
              {unresolvedFlags > 0 && (
                <Link
                  to="/owner/community"
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <MessageSquare size={13} />
                  <span>Moderate {unresolvedFlags} Flags</span>
                </Link>
              )}
              {openIncidents > 0 && (
                <Link
                  to="/owner/safety"
                  className="btn btn-xs"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: criticalIncidents > 0 ? '#ef4444' : 'var(--accent-gold)',
                    color: '#000000',
                    fontWeight: 700,
                  }}
                >
                  <ShieldAlert size={13} />
                  <span>View {openIncidents} Safety Incident{openIncidents > 1 ? 's' : ''}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOP-LEVEL KPI STRIP (4 Compact Metric Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* 1. Live Occupancy */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--color-success)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Live Occupancy</span>
            <Activity size={20} />
          </div>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
            }}
          >
            {loadingMetrics && loadingOverview ? '--' : currentOccupancy}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              / {maxCapacity}
            </span>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div
              style={{
                height: '6px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, occupancyRate)}%`,
                  background:
                    occupancyRate >= 100
                      ? '#ef4444'
                      : occupancyRate >= 80
                      ? '#eab308'
                      : '#22c55e',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{occupancyRate}% capacity</span>
            <span>{maxCapacity - currentOccupancy} slots open</span>
          </div>
        </div>

        {/* 2. Today's Check-ins */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--accent-gold)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Today's Check-ins</span>
            <Clock size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics && loadingOverview
              ? '--'
              : overview?.attendance.todayCheckins ?? todayCheckins}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span>
              {overview?.attendance.todayCompletedVisits ?? 0} completed
            </span>
            <span style={{ margin: '0 4px' }}>•</span>
            <span>
              {overview?.attendance.todayAvgDurationMinutes ?? 0}m avg visit
            </span>
          </div>
        </div>

        {/* 3. Active Members (30d) */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--accent-primary)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Members (30d)</span>
            <Users size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics && loadingOverview
              ? '--'
              : overview?.members.activeMembers30d ?? memberCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span>Distinct check-ins in 30 days</span>
          </div>
        </div>

        {/* 4. Retention Health */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f97316',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Retention Health</span>
            <Flame size={20} />
          </div>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px',
            }}
          >
            {loadingOverview ? '--' : `${overview?.members.retentionHealthPercentage ?? 0}%`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            <span>{overview?.members.streakMembersCount ?? 0} members on ≥3d streak</span>
          </div>
        </div>
      </div>

      {/* PEAK HOURS & FACILITY HEALTH ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Utilization & Peak Hours Bar Chart (Last 7 Facility-Local Days) */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            flex: '2 1 450px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={18} style={{ color: 'var(--accent-gold)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                Check-in Distribution — Last 7 Days
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              24-Hour Facility Local Time
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 'var(--space-4)' }}>
            Hourly volume of member check-ins initiated across the trailing 7 calendar days.
          </p>

          {/* 24-Hour Distribution Histogram */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              height: '110px',
              gap: '3px',
              paddingTop: 'var(--space-2)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {Array.from({ length: 24 }, (_, hour) => {
              const bucket = peakDistribution.find(b => b.hour === hour);
              const count = bucket?.checkins || 0;
              const heightPercent = maxPeakCheckins > 0 ? (count / maxPeakCheckins) * 100 : 0;
              const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20);

              return (
                <div
                  key={hour}
                  title={`${hour}:00 - ${count} check-in${count === 1 ? '' : 's'}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      minHeight: count > 0 ? '4px' : '0px',
                      height: `${Math.max(count > 0 ? 4 : 0, heightPercent)}%`,
                      borderRadius: '2px 2px 0 0',
                      background:
                        count > 0
                          ? isPeakHour
                            ? 'linear-gradient(180deg, #D6A84F 0%, #B8860B 100%)'
                            : 'var(--accent-primary)'
                          : 'rgba(255, 255, 255, 0.05)',
                      transition: 'height 250ms ease',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Hour Labels */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '4px',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>00:00</span>
            <span>06:00 (Morning)</span>
            <span>12:00</span>
            <span>18:00 (Evening)</span>
            <span>23:00</span>
          </div>
        </div>

        {/* Subsystem Snapshots */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              Subsystem Snapshots
            </h3>

            {/* Challenges Snapshot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={16} style={{ color: 'var(--accent-gold)' }} />
                <span style={{ fontSize: '0.85rem' }}>Active Challenges</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                  {overview?.engagement.activeChallengesCount ?? 0}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ({overview?.engagement.challengeParticipantsCount ?? 0} athletes)
                </span>
                <Link to="/owner/challenges" style={{ color: 'var(--accent-gold)', display: 'flex' }}>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Buddy Network Snapshot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem' }}>Active Buddy Pairs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                  {overview?.engagement.activeBuddyConnectionsCount ?? 0}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  accepted pairs
                </span>
                <Link to="/owner/members" style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {/* Safety & Compliance Snapshot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: '0.85rem' }}>Floor Safety Notices</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                  {overview?.safety.activeSafetyNoticesCount ?? 0}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  active
                </span>
                <Link to="/owner/safety" style={{ color: 'var(--color-success)', display: 'flex' }}>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Scan radius: {activeGym.radiusMeters}m</span>
            <span>QR: {activeGym.qrCodeHash ? 'Configured' : 'Missing'}</span>
          </div>
        </div>
      </div>

      {/* FLOOR OPERATIONS TABS (PRESERVED LIVE FLOOR & LEDGER) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          gap: 'var(--space-4)',
        }}
      >
        <button
          onClick={() => setActiveTab('floor')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'floor' ? '2px solid var(--accent-gold)' : '2px solid transparent',
            color: activeTab === 'floor' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity size={18} style={{ color: activeTab === 'floor' ? 'var(--color-success)' : 'inherit' }} />
          <span>Currently Inside ({activeSessions.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('ledger');
            setHistoryPage(1);
          }}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '2px solid var(--accent-gold)' : '2px solid transparent',
            color: activeTab === 'ledger' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <History size={18} style={{ color: activeTab === 'ledger' ? 'var(--accent-gold)' : 'inherit' }} />
          <span>Completed Visits Audit</span>
        </button>
      </div>

      {/* TAB 1: CURRENTLY INSIDE FLOOR */}
      {activeTab === 'floor' && (
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-4)',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                  display: 'inline-block',
                }}
              />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Live Gym Floor</h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {activeSessions.length} athlete{activeSessions.length === 1 ? '' : 's'} training right now (re-syncs every 20s)
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <Activity
                size={36}
                style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-2)' }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
                No athletes are currently checked in on the floor.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>ATHLETE</th>
                    <th style={{ padding: '10px 12px' }}>CHECK-IN TIME</th>
                    <th style={{ padding: '10px 12px' }}>LIVE ELAPSED</th>
                    <th style={{ padding: '10px 12px' }}>VERIFICATION</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map(session => {
                    const checkInDate = new Date(session.checkInAt);
                    const timeFormatted = formatVisitTimeIST(session.checkInAt);

                    const minutesElapsed = Math.max(
                      1,
                      Math.floor((nowTimestamp - checkInDate.getTime()) / (1000 * 60))
                    );

                    const avatar = session.userProfile?.avatarUrl;
                    const name = session.userProfile?.displayName || 'Athlete';

                    return (
                      <tr
                        key={session.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={name}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'var(--accent-primary)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontWeight: 600 }}>{name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {timeFormatted}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--accent-gold)',
                          }}
                        >
                          {minutesElapsed} min
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {formatMethod(session.verificationMethod)}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: 'var(--color-success)',
                              fontSize: '0.75rem',
                            }}
                          >
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPLETED ATTENDANCE AUDIT LEDGER */}
      {activeTab === 'ledger' && (
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            marginBottom: 'var(--space-8)',
          }}
        >
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-5)',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: '1 1 320px' }}>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  maxWidth: '320px',
                }}
              >
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search athlete name..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="input input-sm"
                  style={{ paddingLeft: '36px', width: '100%' }}
                />
              </div>

              {/* Date Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => {
                    setStartDateFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="input input-sm"
                  style={{ fontSize: '0.8rem' }}
                  title="Filter from date"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => {
                    setEndDateFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="input input-sm"
                  style={{ fontSize: '0.8rem' }}
                  title="Filter to date"
                />
              </div>

              {(searchQuery || startDateFilter || endDateFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setHistoryPage(1);
                  }}
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear
                </button>
              )}
            </div>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total: <strong>{historyTotalCount}</strong> verified visits
            </span>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--text-muted)' }}>
              Loading attendance ledger...
            </div>
          ) : historySessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <History size={36} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-2)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
                No completed visit records found matching criteria.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      textAlign: 'left',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>ATHLETE</th>
                    <th style={{ padding: '10px 12px' }}>DATE (IST)</th>
                    <th style={{ padding: '10px 12px' }}>CHECK-IN</th>
                    <th style={{ padding: '10px 12px' }}>CHECK-OUT</th>
                    <th style={{ padding: '10px 12px' }}>DURATION</th>
                    <th style={{ padding: '10px 12px' }}>CHECK-IN METHOD</th>
                    <th style={{ padding: '10px 12px' }}>CHECKOUT METHOD</th>
                  </tr>
                </thead>
                <tbody>
                  {historySessions.map(session => {
                    const name = session.userProfile?.displayName || 'Athlete';
                    const avatar = session.userProfile?.avatarUrl;
                    const dateFormatted = formatVisitDateIST(session.checkInAt);
                    const checkInTime = formatVisitTimeIST(session.checkInAt);
                    const checkOutTime = session.checkOutAt
                      ? formatVisitTimeIST(session.checkOutAt)
                      : '--';
                    const friendlyDuration = session.durationSeconds
                      ? formatFriendlyDuration(session.durationSeconds)
                      : '0 mins';

                    return (
                      <tr key={session.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={name}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  background: 'var(--accent-primary)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontWeight: 600 }}>{name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {dateFormatted}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {checkInTime}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {checkOutTime}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--accent-gold)',
                          }}
                        >
                          {friendlyDuration}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {formatMethod(session.verificationMethod)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          <span
                            className="badge"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {formatMethod(session.checkoutMethod)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalHistoryPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Page {historyPage} of {totalHistoryPages}
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage >= totalHistoryPages}
                  className="btn btn-secondary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Facility Operations Navigation Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <Link
          to="/owner/members"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)' }}>
              <Users size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Member Roster & Passes</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Manage active memberships, approve pending requests, and update athlete passes.
          </p>
        </Link>

        <Link
          to="/owner/events"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-gold)' }}>
              <Calendar size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Events & Workshops</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Publish group workout sessions, bootcamp classes, and seminar schedules.
          </p>
        </Link>

        <Link
          to="/owner/settings"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-success)' }}>
              <ShieldCheck size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Facility Settings</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Configure QR codes, adjust geofence perimeter, and update notification preferences.
          </p>
        </Link>
      </div>
    </div>
  );
};
