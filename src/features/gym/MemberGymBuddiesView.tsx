import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Target,
  Clock,
  Calendar,
  Zap,
  Sun,
  ShieldAlert,
  UserX,
  X,
  Check,
  Settings,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Flame,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymBuddyService, VALID_TIME_WINDOWS } from '@/services/gym-buddy.service';
import {
  GymBuddyCandidate,
  GymBuddyConnection,
  GymBuddyReportReason,
  GymTrainingTimeWindow,
  GymGenderFilter,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MemberGymBuddiesView: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const userId = session?.user?.id;
  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }

  const activeGym = memberGymCtx?.activeGym;
  const activeGymId = activeGym?.id;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'discover' | 'my_buddies'>('discover');

  // Preferences State
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [preferredTime, setPreferredTime] = useState<GymTrainingTimeWindow>('evening');
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [preferredGender, setPreferredGender] = useState<GymGenderFilter>('any');
  const [bioNote, setBioNote] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Candidates State
  const [candidates, setCandidates] = useState<GymBuddyCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Connections State
  const [connections, setConnections] = useState<GymBuddyConnection[]>([]);

  // Action Feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [reportingTarget, setReportingTarget] = useState<{ userId: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState<GymBuddyReportReason>('inappropriate_behavior');
  const [reportDetails, setReportDetails] = useState('');
  const [blockingTarget, setBlockingTarget] = useState<{ userId: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!userId || !activeGymId) return;

    try {
      const pref = await gymBuddyService.getPreference(userId, activeGymId);
      if (pref) {
        setIsOptedIn(pref.isOptedIn);
        setPreferredTime(pref.preferredTrainingTime);
        setPreferredDays(pref.preferredTrainingDays || [1, 2, 3, 4, 5]);
        setPreferredGender(pref.preferredGenderFilter || 'any');
        setBioNote(pref.bioNote || '');
      }

      if (pref?.isOptedIn) {
        setLoadingCandidates(true);
        const candRes = await gymBuddyService.getCandidates(activeGymId);
        setCandidates(candRes.candidates || []);
        setLoadingCandidates(false);
      }

      const conns = await gymBuddyService.getMyConnections(activeGymId, userId);
      setConnections(conns || []);
    } catch (err) {
      logger.error('MemberGymBuddiesView: Error loading buddy data', { err });
    }
  }, [userId, activeGymId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleOptIn = async (newVal: boolean) => {
    if (!activeGymId || !userId) return;
    setIsOptedIn(newVal);
    const res = await gymBuddyService.toggleOptIn(activeGymId, newVal);
    if (!res.success) {
      setIsOptedIn(!newVal);
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update opt-in state' });
    } else {
      setStatusMessage({
        type: 'success',
        text: newVal
          ? 'Buddy discovery enabled! You can now match with members at this gym.'
          : 'Buddy discovery disabled. You have been removed from candidate feeds.',
      });
      loadData();
    }
  };

  const handleSaveSettings = async () => {
    if (!activeGymId || !userId) return;
    const res = await gymBuddyService.savePreference({
      userId,
      gymId: activeGymId,
      isOptedIn,
      preferredTrainingTime: preferredTime,
      preferredTrainingDays: preferredDays,
      preferredGenderFilter: preferredGender,
      bioNote,
    });

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Buddy preferences saved successfully!' });
      setShowSettingsModal(false);
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save preferences' });
    }
  };

  const handleSendRequest = async (targetUserId: string, targetName: string) => {
    if (!activeGymId) return;
    const res = await gymBuddyService.sendRequest(activeGymId, targetUserId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: `Buddy request sent to ${targetName}!` });
      setCandidates(prev => prev.filter(c => c.userId !== targetUserId));
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to send request' });
    }
  };

  const handlePassCandidate = async (targetUserId: string) => {
    if (!activeGymId) return;
    await gymBuddyService.dismissCandidate(activeGymId, targetUserId);
    setCandidates(prev => prev.filter(c => c.userId !== targetUserId));
  };

  const handleRespondRequest = async (connectionId: string, action: 'accept' | 'decline') => {
    const res = await gymBuddyService.respondToRequest(connectionId, action);
    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: action === 'accept' ? 'Buddy connection accepted!' : 'Request declined.',
      });
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to respond to request' });
    }
  };

  const handleCancelRequest = async (connectionId: string) => {
    const res = await gymBuddyService.cancelRequest(connectionId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Request cancelled.' });
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to cancel request' });
    }
  };

  const handleUnmatch = async (connectionId: string) => {
    const res = await gymBuddyService.unmatch(connectionId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Buddy relationship ended.' });
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to unmatch' });
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockingTarget) return;
    const res = await gymBuddyService.blockUser(blockingTarget.userId);
    if (res.success) {
      setStatusMessage({ type: 'success', text: `Blocked ${blockingTarget.name}. You are now mutually invisible.` });
      setBlockingTarget(null);
      loadData();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to block user' });
    }
  };

  const handleConfirmReport = async () => {
    if (!reportingTarget || !activeGymId) return;
    const res = await gymBuddyService.reportUser(activeGymId, reportingTarget.userId, reportReason, reportDetails);
    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Report submitted confidentially to gym management.',
      });
      setReportingTarget(null);
      setReportDetails('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to submit report' });
    }
  };

  const toggleDay = (dayIndex: number) => {
    if (preferredDays.includes(dayIndex)) {
      if (preferredDays.length > 1) {
        setPreferredDays(preferredDays.filter(d => d !== dayIndex));
      }
    } else {
      setPreferredDays([...preferredDays, dayIndex].sort());
    }
  };

  // Group connections
  const incomingRequests = connections.filter(c => c.status === 'pending' && c.requesterId !== userId);
  const outgoingRequests = connections.filter(c => c.status === 'pending' && c.requesterId === userId);
  const activeBuddies = connections.filter(c => c.status === 'accepted');

  // ── No Active Gym Guard ─────────────────────────────────────────────────────
  if (!activeGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <button
          onClick={() => navigate('/app/gym')}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 'var(--space-5)', gap: 'var(--space-2)' }}
        >
          <ArrowLeft size={16} /> Back to Gym Hub
        </button>
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <Users size={48} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            No Active Partner Gym
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
            Gym Buddy Matching is exclusively for athletes with an active membership at a registered partner facility.
          </p>
          <button onClick={() => navigate('/app/gym')} className="btn btn-primary">
            Discover Partner Facilities
          </button>
        </div>
      </div>
    );
  }

  // ── Main View ────────────────────────────────────────────────────────────────
  return (
    <div
      className="container animate-fade-in"
      style={{ padding: 'var(--space-4) var(--space-4) var(--space-12)', maxWidth: '960px' }}
      data-testid="member-gym-buddies-view"
    >
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div>
          <button
            onClick={() => navigate('/app/gym')}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 'var(--space-2)', paddingLeft: 0 }}
          >
            <ArrowLeft size={14} />
            Back to {activeGym.name}
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', marginBottom: '4px' }}>
            <Sparkles size={13} />
            <span>Gym Buddy Matching</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Find Your Training Partner
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Connect with compatible lifters at <strong style={{ color: 'var(--text-primary)' }}>{activeGym.name}</strong>.
          </p>
        </div>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="btn btn-secondary btn-sm"
          aria-label="Open Buddy Preferences"
        >
          <Settings size={15} /> Preferences
        </button>
      </div>

      {/* ── Status Feedback ── */}
      {statusMessage && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-3) var(--space-4)',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.30)' : 'rgba(239, 68, 68, 0.30)'}`,
            color: statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <AlertCircle size={15} />
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px', opacity: 0.7 }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Opt-In Banner ── */}
      <div
        className="card"
        style={{
          marginBottom: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              background: isOptedIn ? 'var(--accent-primary-muted)' : 'var(--bg-secondary)',
              border: `1px solid ${isOptedIn ? 'rgba(79, 140, 255, 0.30)' : 'var(--border-subtle)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isOptedIn ? 'var(--accent-primary)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isOptedIn ? 'Buddy Matching Active' : 'Buddy Matching Paused'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isOptedIn
                ? 'You are visible to compatible lifters at this gym.'
                : 'Enable to discover workout partners and allow peers to find you.'}
            </div>
          </div>
        </div>

        <label className="switch-toggle" title="Toggle Buddy Matching" aria-label="Toggle Buddy Matching">
          <input
            type="checkbox"
            checked={isOptedIn}
            onChange={e => handleToggleOptIn(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-5)', gap: 'var(--space-5)' }}>
        {([
          { key: 'discover', label: `Discover (${candidates.length})` },
          { key: 'my_buddies', label: `My Buddies (${activeBuddies.length})`, badge: incomingRequests.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              paddingBottom: 'var(--space-3)',
              paddingTop: 0,
              paddingLeft: 0,
              paddingRight: 0,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            {'badge' in tab && tab.badge > 0 && (
              <span
                className="badge badge-accent"
                style={{ fontSize: '0.65rem', padding: '1px 6px', fontWeight: 800 }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1 — DISCOVER CANDIDATES
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'discover' && (
        <div>
          {!isOptedIn ? (
            <div className="card card-elevated" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
              <Users size={42} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                Enable Buddy Discovery to Find Partners
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto var(--space-5)' }}>
                Turn on matching to see compatible members training at {activeGym.name} who match your schedule and lifting goals.
              </p>
              <button onClick={() => handleToggleOptIn(true)} className="btn btn-primary">
                Enable Buddy Discovery
              </button>
            </div>
          ) : loadingCandidates ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto var(--space-3)' }} />
              Scanning compatible gym members...
            </div>
          ) : candidates.length === 0 ? (
            <div className="card card-elevated" style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
              <Sparkles size={38} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                All Caught Up!
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto var(--space-4)' }}>
                No new compatible candidates match your schedule right now. Try adjusting your training time or day preferences.
              </p>
              <button onClick={() => setShowSettingsModal(true)} className="btn btn-secondary btn-sm">
                Edit Preferences
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {candidates.map(c => (
                <div key={c.userId} className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {/* Top: Avatar + Name + Match score */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'var(--accent-primary-muted)',
                          border: '1.5px solid rgba(79, 140, 255, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: 'var(--accent-primary)',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          c.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.displayName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {c.experienceLevel} Lifter
                        </div>
                      </div>
                    </div>

                    <span className="badge badge-accent" style={{ fontWeight: 800, gap: '4px' }}>
                      <Flame size={12} fill="var(--accent-primary)" />
                      {c.compatibilityScore}% Match
                    </span>
                  </div>

                  {/* Bio note */}
                  {c.bioNote && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)', fontStyle: 'italic' }}>
                      "{c.bioNote}"
                    </p>
                  )}

                  {/* Match reason badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-4)' }}>
                    {c.matchReasons.map((r, i) => (
                      <span key={i} className="badge" style={{ fontSize: '0.72rem', gap: '4px' }}>
                        {r.icon === 'target' && <Target size={11} style={{ color: 'var(--accent-primary)' }} />}
                        {r.icon === 'sun' && <Sun size={11} style={{ color: 'var(--color-warning)' }} />}
                        {r.icon === 'calendar' && <Calendar size={11} style={{ color: 'var(--color-success)' }} />}
                        {r.icon === 'zap' && <Zap size={11} style={{ color: 'var(--accent-indigo)' }} />}
                        {r.icon === 'clock' && <Clock size={11} style={{ color: 'var(--accent-primary)' }} />}
                        <span>{r.label}</span>
                      </span>
                    ))}
                  </div>

                  {/* Actions row */}
                  <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <button
                        onClick={() => setReportingTarget({ userId: c.userId, name: c.displayName })}
                        title="Report member"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px', color: 'var(--text-muted)', minHeight: '32px' }}
                        aria-label="Report member"
                      >
                        <ShieldAlert size={15} />
                      </button>
                      <button
                        onClick={() => setBlockingTarget({ userId: c.userId, name: c.displayName })}
                        title="Block member"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px', color: 'var(--text-muted)', minHeight: '32px' }}
                        aria-label="Block member"
                      >
                        <UserX size={15} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <button onClick={() => handlePassCandidate(c.userId)} className="btn btn-secondary btn-sm">
                        Pass
                      </button>
                      <button onClick={() => handleSendRequest(c.userId, c.displayName)} className="btn btn-primary btn-sm">
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2 — MY BUDDIES
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'my_buddies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                Incoming Requests ({incomingRequests.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {incomingRequests.map(req => {
                  const partner = req.partnerProfile;
                  return (
                    <div
                      key={req.id}
                      className="card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-4)',
                        border: '1px solid rgba(79, 140, 255, 0.30)',
                        background: 'rgba(79, 140, 255, 0.05)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'var(--accent-primary-muted)',
                            border: '1px solid rgba(79, 140, 255, 0.30)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: 'var(--accent-primary)',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {partner?.avatarUrl ? (
                            <img src={partner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            partner?.displayName?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {partner?.displayName || 'Gym Member'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {partner?.goal ? `Goal: ${partner.goal.replace('_', ' ')}` : 'Wants to workout together'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button onClick={() => handleRespondRequest(req.id, 'decline')} className="btn btn-secondary btn-sm">
                          Decline
                        </button>
                        <button onClick={() => handleRespondRequest(req.id, 'accept')} className="btn btn-primary btn-sm">
                          <Check size={14} /> Accept
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outgoing Requests */}
          {outgoingRequests.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                Sent Requests ({outgoingRequests.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {outgoingRequests.map(req => {
                  const partner = req.partnerProfile;
                  return (
                    <div
                      key={req.id}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {partner?.displayName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {partner?.displayName || 'Gym Member'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Awaiting response</div>
                        </div>
                      </div>
                      <button onClick={() => handleCancelRequest(req.id)} className="btn btn-secondary btn-sm">
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Buddies */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
              Active Gym Buddies ({activeBuddies.length})
            </div>
            {activeBuddies.length === 0 ? (
              <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active gym buddies yet. Head to the Discover tab to connect with lifters!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                {activeBuddies.map(b => {
                  const partner = b.partnerProfile;
                  return (
                    <div
                      key={b.id}
                      className="card"
                      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1.5px solid rgba(16, 185, 129, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: 'var(--color-success)',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          {partner?.avatarUrl ? (
                            <img src={partner.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            partner?.displayName?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {partner?.displayName}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> Active Training Partner
                          </div>
                        </div>
                      </div>

                      <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <button
                            onClick={() =>
                              setReportingTarget({
                                userId: b.userAId === userId ? b.userBId : b.userAId,
                                name: partner?.displayName || 'Member',
                              })
                            }
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px', minHeight: '28px' }}
                          >
                            Report
                          </button>
                          <button
                            onClick={() =>
                              setBlockingTarget({
                                userId: b.userAId === userId ? b.userBId : b.userAId,
                                name: partner?.displayName || 'Member',
                              })
                            }
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 8px', minHeight: '28px' }}
                          >
                            Block
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <button
                            onClick={() => navigate(`/app/gym/buddies/${b.id}/chat`)}
                            className="btn btn-primary btn-sm"
                          >
                            <MessageSquare size={13} /> Chat
                          </button>
                          <button
                            onClick={() => handleUnmatch(b.id)}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minHeight: '28px' }}
                          >
                            Unmatch
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PREFERENCES / SETTINGS MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {showSettingsModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Settings size={18} style={{ color: 'var(--accent-primary)' }} /> Buddy Matching Preferences
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Time Window */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-2)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                Preferred Training Time
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                {VALID_TIME_WINDOWS.map(tw => (
                  <button
                    key={tw}
                    type="button"
                    onClick={() => setPreferredTime(tw)}
                    className={preferredTime === tw ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    style={{ textTransform: 'capitalize', justifyContent: 'flex-start' }}
                  >
                    {tw.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Training Days */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-2)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                Preferred Training Days
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                {DAY_LABELS.map((d, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={preferredDays.includes(idx) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    style={{ flex: 1, padding: '0 4px', fontSize: '0.72rem' }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender Filter */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-2)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                Partner Gender Preference
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {(['any', 'same_gender'] as const).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPreferredGender(val)}
                    className={preferredGender === val ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    style={{ flex: 1 }}
                  >
                    {val === 'any' ? 'Any Gender' : 'Same Gender Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio Note */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                Short Training Bio (Max 160 chars)
              </label>
              <textarea
                value={bioNote}
                onChange={e => setBioNote(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="e.g., Training for hypertrophy, looking for a bench spotter on push days."
                className="textarea"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                {bioNote.length}/160
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowSettingsModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleSaveSettings} className="btn btn-primary btn-sm">
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          BLOCK CONFIRMATION MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {blockingTarget && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setBlockingTarget(null); }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
            <UserX size={36} style={{ color: 'var(--color-error)', margin: '0 auto var(--space-3)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
              Block {blockingTarget.name}?
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
              Blocking is global. You will become mutually invisible across all partner gyms, and any active buddy connection will be immediately ended.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button onClick={() => setBlockingTarget(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleConfirmBlock} className="btn btn-danger btn-sm">
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          REPORT MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {reportingTarget && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setReportingTarget(null); }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <ShieldAlert size={18} /> Report Member
              </h3>
              <button onClick={() => setReportingTarget(null)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Filing a confidential conduct report for <strong style={{ color: 'var(--text-primary)' }}>{reportingTarget.name}</strong>. The reported user will never see your identity.
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                Reason
              </label>
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value as GymBuddyReportReason)}
                className="select"
                style={{ fontSize: '0.85rem' }}
              >
                <option value="inappropriate_behavior">Inappropriate Behavior</option>
                <option value="harassment">Harassment / Bullying</option>
                <option value="unsolicited_contact">Unsolicited Contact</option>
                <option value="impersonation">Impersonation / Fake Profile</option>
                <option value="spam">Spam or Commercial Solicitation</option>
                <option value="safety_concern">Safety Concern</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label className="label" style={{ display: 'block', marginBottom: 'var(--space-1)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                Additional Details
              </label>
              <textarea
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                rows={3}
                placeholder="Describe what occurred (optional)..."
                className="textarea"
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button onClick={() => setReportingTarget(null)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleConfirmReport} className="btn btn-danger btn-sm">
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
