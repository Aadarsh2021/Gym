import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Calendar,
  Zap,
  Users,
  CheckCircle2,
  Medal,
  Clock,
  TrendingUp,
  Award,
  AlertCircle,
  X,
  Flame,
  Dumbbell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymChallengeService } from '@/services/gym-challenge.service';
import {
  GymChallenge,
  GymChallengeParticipant,
  GymChallengeLeaderboardEntry,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

export const MemberGymChallengesView: React.FC = () => {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;

  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }
  const activeGym = memberGymCtx?.activeGym;
  const activeGymId = activeGym?.id;

  const [activeTab, setActiveTab] = useState<'active' | 'my_challenges' | 'past'>('active');
  const [challenges, setChallenges] = useState<GymChallenge[]>([]);
  const [myParticipations, setMyParticipations] = useState<Record<string, GymChallengeParticipant>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Leaderboard Modal State
  const [selectedChallengeForLeaderboard, setSelectedChallengeForLeaderboard] = useState<GymChallenge | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<GymChallengeLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Join Action State
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // 1. Fetch Challenges & Participations
  const loadChallenges = useCallback(async () => {
    if (!activeGymId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const list = await gymChallengeService.getChallenges(activeGymId);
      setChallenges(list);

      // Fetch participation for current user for each challenge
      if (currentUserId) {
        const partsMap: Record<string, GymChallengeParticipant> = {};
        await Promise.all(
          list.map(async ch => {
            const part = await gymChallengeService.getMyParticipation(ch.id, currentUserId);
            if (part) {
              partsMap[ch.id] = part;
            }
          })
        );
        setMyParticipations(partsMap);
      }
    } catch (err: any) {
      logger.error('Error loading challenges', { err });
      setErrorMsg(err.message || 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, [activeGymId, currentUserId]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  // 2. Join Challenge Handler
  const handleJoinChallenge = async (challengeId: string) => {
    try {
      setJoiningId(challengeId);
      setErrorMsg(null);
      const part = await gymChallengeService.joinChallenge(challengeId);
      setMyParticipations(prev => ({ ...prev, [challengeId]: part }));

      // Refresh challenge list participant count
      setChallenges(prev =>
        prev.map(c => (c.id === challengeId ? { ...c, participantCount: (c.participantCount || 0) + 1 } : c))
      );
    } catch (err: any) {
      logger.error('Error joining challenge', { err });
      setErrorMsg(err.message || 'Failed to join challenge');
    } finally {
      setJoiningId(null);
    }
  };

  // 3. Open Leaderboard Handler
  const handleOpenLeaderboard = async (challenge: GymChallenge) => {
    setSelectedChallengeForLeaderboard(challenge);
    setLeaderboardLoading(true);
    try {
      const entries = await gymChallengeService.getLeaderboard(challenge.id, 50);
      setLeaderboardEntries(entries);
    } catch (err: any) {
      logger.error('Error loading leaderboard', { err });
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Filter challenges by tab
  const now = new Date();
  const activeChallenges = challenges.filter(c => c.status === 'active' || (c.status === 'published' && new Date(c.endAt) > now));
  const myJoinedChallenges = challenges.filter(c => !!myParticipations[c.id]);
  const pastChallenges = challenges.filter(c => c.status === 'completed' || c.status === 'archived' || new Date(c.endAt) <= now);

  const displayedChallenges =
    activeTab === 'active'
      ? activeChallenges
      : activeTab === 'my_challenges'
      ? myJoinedChallenges
      : pastChallenges;

  const formatChallengeType = (type: string) => {
    switch (type) {
      case 'attendance_count':
        return { label: 'Attendance Sprint', icon: Calendar, color: 'var(--accent-primary)' };
      case 'workout_count':
        return { label: 'Workout Target', icon: Dumbbell, color: 'var(--color-success)' };
      case 'workout_volume':
        return { label: 'Volume Champion', icon: TrendingUp, color: 'var(--accent-primary)' };
      case 'attendance_streak':
        return { label: 'Streak Builder', icon: Flame, color: '#F97316' };
      default:
        return { label: 'Competition', icon: Trophy, color: 'var(--accent-primary)' };
    }
  };

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* 1. Header Banner */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
          <Trophy size={16} />
          <span>{activeGym?.name ? activeGym.name.toUpperCase() : 'INTRA-GYM COMPETITIONS'}</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Facility Challenges & Leaderboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Compete with fellow gym athletes, climb the facility leaderboard, and earn verified fitness rewards.
        </p>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        <button
          onClick={() => setActiveTab('active')}
          className="btn btn-ghost btn-sm"
          style={{
            fontWeight: activeTab === 'active' ? 700 : 500,
            color: activeTab === 'active' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'active' ? '2px solid var(--accent-primary)' : 'none',
            borderRadius: 0,
            padding: '8px 16px',
          }}
        >
          Active Competitions ({activeChallenges.length})
        </button>

        <button
          onClick={() => setActiveTab('my_challenges')}
          className="btn btn-ghost btn-sm"
          style={{
            fontWeight: activeTab === 'my_challenges' ? 700 : 500,
            color: activeTab === 'my_challenges' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'my_challenges' ? '2px solid var(--accent-primary)' : 'none',
            borderRadius: 0,
            padding: '8px 16px',
          }}
        >
          My Challenges ({myJoinedChallenges.length})
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className="btn btn-ghost btn-sm"
          style={{
            fontWeight: activeTab === 'past' ? 700 : 500,
            color: activeTab === 'past' ? 'var(--accent-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'past' ? '2px solid var(--accent-primary)' : 'none',
            borderRadius: 0,
            padding: '8px 16px',
          }}
        >
          Past Competitions ({pastChallenges.length})
        </button>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: '0.85rem',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Challenges Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-muted)' }}>
          Loading gym challenges...
        </div>
      ) : displayedChallenges.length === 0 ? (
        <div className="card card-elevated" style={{ padding: 'var(--space-10)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Challenges Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto' }}>
            {activeTab === 'my_challenges'
              ? "You haven't joined any challenges yet. Check out the Active tab to participate!"
              : 'Your facility owner has not published any competitions in this category yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {displayedChallenges.map(ch => {
            const typeInfo = formatChallengeType(ch.challengeType);
            const TypeIcon = typeInfo.icon;
            const myPart = myParticipations[ch.id];
            const isJoined = !!myPart;
            const score = myPart ? myPart.currentScore : 0;
            const progressPct = ch.targetValue > 0 ? Math.min(100, Math.round((score / ch.targetValue) * 100)) : 0;
            const isCompleted = myPart?.status === 'completed' || score >= ch.targetValue;
            const daysRemaining = Math.max(0, Math.ceil((new Date(ch.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

            return (
              <div
                key={ch.id}
                className="card card-elevated"
                style={{
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderColor: isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                }}
              >
                <div>
                  {/* Top Bar: Type Badge & Days Left */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'rgba(255,255,255,0.06)',
                        color: typeInfo.color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <TypeIcon size={14} />
                      <span>{typeInfo.label}</span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{daysRemaining > 0 ? `${daysRemaining}d left` : 'Finished'}</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 'var(--space-2)', lineHeight: 1.3 }}>
                    {ch.title}
                  </h3>
                  {ch.description && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.45 }}>
                      {ch.description}
                    </p>
                  )}

                  {/* Target & Reward Metric */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      marginBottom: 'var(--space-4)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target Goal</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {ch.targetValue} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>{ch.scoringUnit}</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Reward</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Award size={16} />
                        <span>{ch.rewardCoins ? `${ch.rewardCoins} Coins` : ch.rewardBadgeName || 'Badge'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar if Joined */}
                  {isJoined && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: isCompleted ? 'var(--color-success)' : 'var(--text-primary)' }}>
                          {isCompleted ? 'Target Achieved!' : `My Progress: ${score} / ${ch.targetValue} ${ch.scoringUnit}`}
                        </span>
                        <span style={{ fontWeight: 700, color: isCompleted ? 'var(--color-success)' : 'var(--accent-primary)' }}>
                          {progressPct}%
                        </span>
                      </div>

                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progressPct}%`,
                            background: isCompleted ? 'var(--color-success)' : 'var(--accent-primary)',
                            borderRadius: '4px',
                            transition: 'width 300ms ease',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={14} />
                    <span>{ch.participantCount || 0} enrolled</span>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => handleOpenLeaderboard(ch)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trophy size={14} />
                      <span>Rankings</span>
                    </button>

                    {!isJoined ? (
                      <button
                        onClick={() => handleJoinChallenge(ch.id)}
                        disabled={joiningId === ch.id || ch.status !== 'active'}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Zap size={14} />
                        <span>{joiningId === ch.id ? 'Joining...' : 'Join'}</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--color-success)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '4px 8px',
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Enrolled</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Leaderboard Modal */}
      {selectedChallengeForLeaderboard && (
        <div className="modal-backdrop" onClick={() => setSelectedChallengeForLeaderboard(null)}>
          <div
            className="modal-content animate-fade-in"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '640px',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
                  <Trophy size={14} />
                  <span>FACILITY LEADERBOARD</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedChallengeForLeaderboard.title}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Target: {selectedChallengeForLeaderboard.targetValue} {selectedChallengeForLeaderboard.scoringUnit}
                </div>
              </div>

              <button
                onClick={() => setSelectedChallengeForLeaderboard(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '6px' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Leaderboard Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
              {leaderboardLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                  Calculating rankings...
                </div>
              ) : leaderboardEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                  No participants on the leaderboard yet. Be the first to join!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {leaderboardEntries.map(entry => {
                    const isMe = entry.userId === currentUserId;
                    const rank = entry.rank;

                    let badgeColor = 'var(--text-muted)';
                    if (rank === 1) badgeColor = 'var(--accent-primary)';
                    else if (rank === 2) badgeColor = 'var(--text-secondary)';
                    else if (rank === 3) badgeColor = 'var(--text-muted)';

                    return (
                      <div
                        key={entry.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-3) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          background: isMe ? 'rgba(79, 70, 229, 0.12)' : 'var(--bg-glass-card)',
                          border: isMe ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          {/* Rank Icon / Number */}
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: rank <= 3 ? badgeColor : 'var(--text-muted)',
                              background: rank <= 3 ? 'rgba(255,255,255,0.06)' : 'transparent',
                            }}
                          >
                            {rank <= 3 ? <Medal size={18} /> : `#${rank}`}
                          </div>

                          {/* Avatar */}
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-subtle)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            {entry.avatarUrl ? (
                              <img src={entry.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              entry.displayName.charAt(0)
                            )}
                          </div>

                          {/* Name & Completion */}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                              {entry.displayName} {isMe && '(You)'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {entry.isCompleted ? (
                                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Goal Completed</span>
                              ) : (
                                `${entry.progressPercentage}% of goal`
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Score */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {entry.currentScore}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {entry.scoringUnit}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
              <button onClick={() => setSelectedChallengeForLeaderboard(null)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
