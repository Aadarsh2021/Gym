import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { ownerDashboardService } from '@/services/owner-dashboard.service';
import { GymAttendanceSession } from '@/types/gym.types';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerDashboardView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  // Tab mode: 'floor' | 'ledger'
  const [activeTab, setActiveTab] = useState<'floor' | 'ledger'>('floor');

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

  // 1. Fetch live floor metrics
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

  // 2. Fetch completed attendance ledger
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

  // Initial load and polling sync (every 20s for active floor)
  useEffect(() => {
    fetchLiveMetrics();

    const pollInterval = setInterval(() => {
      fetchLiveMetrics();
    }, 20000);

    return () => clearInterval(pollInterval);
  }, [fetchLiveMetrics]);

  // Load history ledger when switched to 'ledger' or when filters change
  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchHistoryLedger();
    }
  }, [activeTab, fetchHistoryLedger]);

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

  // 2. OWNER WITH ACTIVE GYM — Real Live Dashboard & Audit Ledger
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
            <span>FACILITY CONSOLE</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeGym.name}</h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <MapPin size={14} />
            <span>
              {activeGym.address}, {activeGym.city}
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            onClick={() => {
              if (activeTab === 'floor') {
                fetchLiveMetrics(true);
              } else {
                fetchHistoryLedger();
              }
            }}
            disabled={isRefreshing || historyLoading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh facility data"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing || historyLoading ? 'spin 1s linear infinite' : 'none',
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
            <span>Add Another Gym</span>
          </Link>
        </div>
      </div>

      {/* Operational Metrics Cards (100% Real Supabase Data) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Currently in Gym */}
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Currently Inside</span>
            <Activity size={20} />
          </div>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
            }}
          >
            {loadingMetrics ? '--' : activeSessions.length}
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
              }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Active attendance sessions on floor
          </div>
        </div>

        {/* Today's Check-ins (IST Convention) */}
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
            {loadingMetrics ? '--' : todayCheckins}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            IST day completed & active visits
          </div>
        </div>

        {/* Registered Active Members */}
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enrolled Athletes</span>
            <Users size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics ? '--' : memberCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Verified active passes
          </div>
        </div>

        {/* Geofence Perimeter */}
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
              color: 'var(--accent-cyan)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Check-in Perimeter</span>
            <MapPin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {activeGym.radiusMeters}m
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Authorized scan radius
          </div>
        </div>
      </div>

      {/* Feature 1 & 2 Tabs: Live Floor vs Completed Ledger */}
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
              {activeSessions.length} athlete{activeSessions.length === 1 ? '' : 's'} training right now
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
