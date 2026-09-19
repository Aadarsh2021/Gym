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

  if (!activeGym) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/app/gym')}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Gym Hub
        </button>
        <div className="p-8 rounded-xl bg-bg-surface border border-border-subtle text-center">
          <Users size={48} className="mx-auto text-text-muted mb-4 opacity-40" />
          <h2 className="text-xl font-bold text-text-primary mb-2">No Active Partner Gym Selected</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
            Gym Buddy Matching is an exclusive capability for athletes with an active membership at a registered partner facility.
          </p>
          <button
            onClick={() => navigate('/app/gym')}
            className="px-5 py-2.5 bg-accent-primary text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Discover Partner Facilities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
      {/* Header & Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate('/app/gym')}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to {activeGym.name}
          </button>
          <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
            <Users className="text-accent-primary" size={24} /> Gym Buddy Matching
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Connect with compatible lifters at <span className="text-text-secondary font-medium">{activeGym.name}</span>.
          </p>
        </div>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-bg-surface border border-border-subtle text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-border-medium transition-all"
        >
          <Settings size={15} /> Preferences
        </button>
      </div>

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Opt-In Banner */}
      <div className="mb-6 p-4 rounded-xl bg-bg-surface border border-border-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${isOptedIn ? 'bg-accent-primary/20 text-accent-primary' : 'bg-bg-tertiary text-text-muted'}`}>
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary">
              {isOptedIn ? 'Buddy Matching is Active' : 'Buddy Matching is Paused'}
            </div>
            <div className="text-xs text-text-muted">
              {isOptedIn
                ? 'You are visible to compatible lifters at this gym.'
                : 'Turn on to discover workout partners and allow peers to find you.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isOptedIn}
              onChange={e => handleToggleOptIn(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-6 gap-6">
        <button
          onClick={() => setActiveTab('discover')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'discover'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Discover Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setActiveTab('my_buddies')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'my_buddies'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          My Buddies ({activeBuddies.length})
          {incomingRequests.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-black bg-accent-primary text-white rounded-full">
              {incomingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DISCOVER CANDIDATES */}
      {activeTab === 'discover' && (
        <div>
          {!isOptedIn ? (
            <div className="p-10 rounded-xl bg-bg-surface border border-border-subtle text-center">
              <Users size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
              <h3 className="text-base font-bold text-text-primary mb-1">Enable Buddy Discovery to Find Partners</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto mb-5">
                Turn on matching to see compatible members training at {activeGym.name} who match your schedule and lifting goals.
              </p>
              <button
                onClick={() => handleToggleOptIn(true)}
                className="px-5 py-2.5 bg-accent-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Enable Buddy Discovery
              </button>
            </div>
          ) : loadingCandidates ? (
            <div className="p-12 text-center text-xs text-text-muted">Scanning compatible gym members...</div>
          ) : candidates.length === 0 ? (
            <div className="p-10 rounded-xl bg-bg-surface border border-border-subtle text-center">
              <Sparkles size={36} className="mx-auto text-text-muted mb-3 opacity-40" />
              <h3 className="text-base font-bold text-text-primary mb-1">All Caught Up!</h3>
              <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
                No new compatible candidates match your schedule right now. Try adjusting your training time or day preferences.
              </p>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary text-xs font-semibold rounded-lg transition-colors"
              >
                Edit Preferences
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map(c => (
                <div
                  key={c.userId}
                  className="p-5 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-medium transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Avatar, Name, Match Score */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center font-black text-accent-primary text-base">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            c.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{c.displayName}</h4>
                          <span className="text-[11px] text-text-muted font-medium capitalize">
                            {c.experienceLevel} Lifter
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-bold">
                        <Flame size={13} />
                        <span>{c.compatibilityScore}% Match</span>
                      </div>
                    </div>

                    {/* Bio note if present */}
                    {c.bioNote && (
                      <p className="text-xs text-text-secondary bg-bg-tertiary/50 p-2.5 rounded-lg border border-border-subtle mb-3 italic">
                        "{c.bioNote}"
                      </p>
                    )}

                    {/* Explainable Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {c.matchReasons.map((r, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-bg-tertiary border border-border-subtle text-[11px] font-medium text-text-secondary flex items-center gap-1"
                        >
                          {r.icon === 'target' && <Target size={11} className="text-blue-400" />}
                          {r.icon === 'sun' && <Sun size={11} className="text-amber-400" />}
                          {r.icon === 'calendar' && <Calendar size={11} className="text-emerald-400" />}
                          {r.icon === 'zap' && <Zap size={11} className="text-purple-400" />}
                          {r.icon === 'clock' && <Clock size={11} className="text-indigo-400" />}
                          <span>{r.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setReportingTarget({ userId: c.userId, name: c.displayName })}
                        title="Report member"
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                      >
                        <ShieldAlert size={15} />
                      </button>
                      <button
                        onClick={() => setBlockingTarget({ userId: c.userId, name: c.displayName })}
                        title="Block member"
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                      >
                        <UserX size={15} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePassCandidate(c.userId)}
                        className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => handleSendRequest(c.userId, c.displayName)}
                        className="px-4 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                      >
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

      {/* TAB 2: MY BUDDIES */}
      {activeTab === 'my_buddies' && (
        <div className="space-y-6">
          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-accent-primary uppercase tracking-wider mb-3">
                Incoming Requests ({incomingRequests.length})
              </h3>
              <div className="space-y-2">
                {incomingRequests.map(req => {
                  const partner = req.partnerProfile;
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-bg-surface border border-accent-primary/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-sm">
                          {partner?.avatarUrl ? (
                            <img src={partner.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            partner?.displayName?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary">{partner?.displayName || 'Gym Member'}</div>
                          <div className="text-[11px] text-text-muted">
                            {partner?.goal ? `Goal: ${partner.goal.replace('_', ' ')}` : 'Wants to workout together'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespondRequest(req.id, 'decline')}
                          className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleRespondRequest(req.id, 'accept')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:opacity-90 transition-opacity"
                        >
                          Accept
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
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                Sent Requests ({outgoingRequests.length})
              </h3>
              <div className="space-y-2">
                {outgoingRequests.map(req => {
                  const partner = req.partnerProfile;
                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-bg-surface border border-border-subtle flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-bg-tertiary flex items-center justify-center text-text-muted font-bold text-xs">
                          {partner?.displayName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{partner?.displayName || 'Gym Member'}</div>
                          <div className="text-[11px] text-text-muted">Awaiting response</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        className="px-3 py-1 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-medium transition-colors"
                      >
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
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
              Active Gym Buddies ({activeBuddies.length})
            </h3>
            {activeBuddies.length === 0 ? (
              <div className="p-8 rounded-xl bg-bg-surface border border-border-subtle text-center text-xs text-text-muted">
                No active gym buddies yet. Head to the Discover tab to connect with lifters!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeBuddies.map(b => {
                  const partner = b.partnerProfile;
                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
                            {partner?.avatarUrl ? (
                              <img src={partner.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              partner?.displayName?.charAt(0) || '?'
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text-primary">{partner?.displayName}</div>
                            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                              <Check size={12} /> Active Training Partner
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setReportingTarget({
                                userId: b.userAId === userId ? b.userBId : b.userAId,
                                name: partner?.displayName || 'Member',
                              })
                            }
                            title="Report"
                            className="text-xs text-text-muted hover:text-red-400"
                          >
                            Report
                          </button>
                          <span className="text-text-muted opacity-40">·</span>
                          <button
                            onClick={() =>
                              setBlockingTarget({
                                userId: b.userAId === userId ? b.userBId : b.userAId,
                                name: partner?.displayName || 'Member',
                              })
                            }
                            title="Block"
                            className="text-xs text-text-muted hover:text-red-400"
                          >
                            Block
                          </button>
                        </div>

                        <button
                          onClick={() => handleUnmatch(b.id)}
                          className="text-xs font-semibold text-text-muted hover:text-red-400 transition-colors"
                        >
                          Unmatch
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PREFERENCES / SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Settings size={18} className="text-accent-primary" /> Buddy Matching Preferences
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            {/* Time Window */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-text-muted uppercase mb-2">Preferred Training Time</label>
              <div className="grid grid-cols-2 gap-2">
                {VALID_TIME_WINDOWS.map(tw => (
                  <button
                    key={tw}
                    type="button"
                    onClick={() => setPreferredTime(tw)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-left border transition-all capitalize ${
                      preferredTime === tw
                        ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                        : 'bg-bg-tertiary border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tw.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Training Days */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-text-muted uppercase mb-2">Preferred Training Days</label>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((d, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                      preferredDays.includes(idx)
                        ? 'bg-accent-primary text-white'
                        : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender Filter */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-text-muted uppercase mb-2">Partner Gender Preference</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredGender('any')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                    preferredGender === 'any'
                      ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                      : 'bg-bg-tertiary border-border-subtle text-text-secondary'
                  }`}
                >
                  Any Gender
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredGender('same_gender')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
                    preferredGender === 'same_gender'
                      ? 'bg-accent-primary/20 border-accent-primary text-text-primary'
                      : 'bg-bg-tertiary border-border-subtle text-text-secondary'
                  }`}
                >
                  Same Gender Only
                </button>
              </div>
            </div>

            {/* Bio Note */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                Short Training Bio (Max 160 chars)
              </label>
              <textarea
                value={bioNote}
                onChange={e => setBioNote(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="e.g., Training for hypertrophy, looking for a bench spotter on push days."
                className="w-full p-2.5 text-xs rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary focus:outline-none focus:border-accent-primary resize-none"
              />
              <div className="text-[10px] text-text-muted text-right mt-1">{bioNote.length}/160</div>
            </div>

            {/* Save Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-5 py-2 rounded-lg bg-accent-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK CONFIRMATION MODAL */}
      {blockingTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-red-500/30 rounded-2xl max-w-sm w-full p-6 text-center">
            <UserX size={36} className="mx-auto text-red-400 mb-3" />
            <h3 className="text-base font-bold text-text-primary mb-2">Block {blockingTarget.name}?</h3>
            <p className="text-xs text-text-muted mb-6">
              Blocking is global. You will become mutually invisible across all partner gyms, and any active buddy connection will be immediately ended.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setBlockingTarget(null)}
                className="px-4 py-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:opacity-90"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {reportingTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-400" /> Report Member
              </h3>
              <button onClick={() => setReportingTarget(null)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-4">
              Filing a confidential conduct report for <span className="font-semibold text-text-primary">{reportingTarget.name}</span>. The reported user will never see your identity.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Reason</label>
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value as GymBuddyReportReason)}
                className="w-full p-2.5 text-xs rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary focus:outline-none focus:border-accent-primary"
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

            <div className="mb-6">
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Additional Details</label>
              <textarea
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                rows={3}
                placeholder="Describe what occurred (optional)..."
                className="w-full p-2.5 text-xs rounded-lg bg-bg-tertiary border border-border-subtle text-text-primary focus:outline-none focus:border-accent-primary resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReportingTarget(null)}
                className="px-4 py-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-text-primary text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReport}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:opacity-90"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
