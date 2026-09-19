import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { gymChallengeService } from '@/services/gym-challenge.service';
import {
  GymChallenge,
  GymChallengeType,
  GymChallengeScoringUnit,
  GymChallengeLeaderboardEntry,
} from '@/types/gym.types';
import {
  Trophy,
  Plus,
  Target,
  Calendar,
  Award,
  Users,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  X,
  Send,
  Loader2,
} from 'lucide-react';

export const OwnerChallengesView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  const [challenges, setChallenges] = useState<GymChallenge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Create Challenge Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<GymChallengeType>('attendance_count');
  const [formTargetValue, setFormTargetValue] = useState<number>(15);
  const [formScoringUnit, setFormScoringUnit] = useState<GymChallengeScoringUnit>('days');
  const [formStartAt, setFormStartAt] = useState<string>('');
  const [formEndAt, setFormEndAt] = useState<string>('');
  const [formRewardBadge, setFormRewardBadge] = useState<string>('');
  const [formRewardCoins, setFormRewardCoins] = useState<number>(100);

  // Leaderboard Modal
  const [selectedChallengeForLeaderboard, setSelectedChallengeForLeaderboard] = useState<GymChallenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<GymChallengeLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  const loadChallenges = useCallback(async () => {
    if (!activeGym) return;
    try {
      setLoading(true);
      setError(null);
      const data = await gymChallengeService.getChallenges(
        activeGym.id,
        filterStatus === 'all' ? undefined : filterStatus
      );
      setChallenges(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load challenges';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeGym, filterStatus]);

  useEffect(() => {
    if (activeGym?.id) {
      loadChallenges();
    }
  }, [activeGym?.id, loadChallenges]);

  const handleTypeChange = (type: GymChallengeType) => {
    setFormType(type);
    if (type === 'attendance_count') {
      setFormScoringUnit('days');
      setFormTargetValue(15);
    } else if (type === 'attendance_streak') {
      setFormScoringUnit('streak_days');
      setFormTargetValue(10);
    } else if (type === 'workout_count') {
      setFormScoringUnit('workouts');
      setFormTargetValue(20);
    } else if (type === 'workout_volume') {
      setFormScoringUnit('kg');
      setFormTargetValue(10000);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym) return;
    if (!formTitle.trim()) {
      setError('Challenge title is required');
      return;
    }
    if (!formStartAt || !formEndAt) {
      setError('Start date and end date are required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await gymChallengeService.createChallenge({
        gymId: activeGym.id,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        challengeType: formType,
        targetValue: Number(formTargetValue),
        scoringUnit: formScoringUnit,
        startAt: new Date(formStartAt).toISOString(),
        endAt: new Date(formEndAt).toISOString(),
        rewardBadgeName: formRewardBadge.trim() || undefined,
        rewardCoins: Number(formRewardCoins) || 0,
      });

      setIsCreateOpen(false);
      resetForm();
      setActionSuccess('Challenge draft created successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadChallenges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create challenge';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormType('attendance_count');
    setFormTargetValue(15);
    setFormScoringUnit('days');
    setFormStartAt('');
    setFormEndAt('');
    setFormRewardBadge('');
    setFormRewardCoins(100);
  };

  const handlePublishChallenge = async (challengeId: string) => {
    try {
      setError(null);
      await gymChallengeService.publishChallenge(challengeId);
      setActionSuccess('Challenge published and now active for members!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadChallenges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish challenge';
      setError(msg);
    }
  };

  const handleOpenLeaderboard = async (challenge: GymChallenge) => {
    setSelectedChallengeForLeaderboard(challenge);
    try {
      setLoadingLeaderboard(true);
      const data = await gymChallengeService.getLeaderboard(challenge.id, 50, 0);
      setLeaderboard(data);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  if (loadingGym) {
    return (
      <div className="container" style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (!activeGym) {
    return (
      <div className="container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <AlertCircle size={36} style={{ color: 'var(--accent-warning)', margin: '0 auto var(--space-2)' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No Active Facility Selected</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please select or register a gym to manage challenges.</p>
        </div>
      </div>
    );
  }

  const activeCount = challenges.filter(c => c.status === 'active').length;
  const draftCount = challenges.filter(c => c.status === 'draft').length;
  const totalParticipants = challenges.reduce((acc, c) => acc + (c.participantCount || 0), 0);

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Trophy size={16} />
            <span>INTRA-GYM COMPETITIONS & GAMIFICATION</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Challenges Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Manage attendance and workout volume challenges to supercharge member retention at <strong>{activeGym.name}</strong>.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            // Default dates: start now, end in 30 days
            const now = new Date();
            const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            setFormStartAt(now.toISOString().slice(0, 16));
            setFormEndAt(in30.toISOString().slice(0, 16));
            setIsCreateOpen(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Create Challenge</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#10b981', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', color: '#ef4444', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Challenges</span>
            <Target size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live member competitions</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Drafts</span>
            <Clock size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{draftCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unpublished competitions</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Participants</span>
            <Users size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalParticipants}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered gym members</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
        {['all', 'active', 'draft', 'completed'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className="btn btn-sm"
            style={{
              background: filterStatus === st ? 'var(--accent-primary)' : 'transparent',
              color: filterStatus === st ? '#fff' : 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              textTransform: 'capitalize',
              fontWeight: filterStatus === st ? 600 : 400,
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Challenges List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto', color: 'var(--accent-primary)' }} />
        </div>
      ) : challenges.length === 0 ? (
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <Trophy size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Challenges Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto var(--space-4)' }}>
            Create an attendance or workout volume challenge to motivate your members and award gym badges.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
          {challenges.map(chall => (
            <div
              key={chall.id}
              className="card card-elevated"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background:
                        chall.status === 'active'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : chall.status === 'draft'
                          ? 'rgba(234, 179, 8, 0.2)'
                          : 'rgba(107, 114, 128, 0.2)',
                      color:
                        chall.status === 'active'
                          ? '#10b981'
                          : chall.status === 'draft'
                          ? '#eab308'
                          : 'var(--text-muted)',
                    }}
                  >
                    {chall.status}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                    <Users size={15} />
                    <span>{chall.participantCount || 0}</span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  {chall.title}
                </h3>

                {chall.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--space-3)', lineHeight: 1.4 }}>
                    {chall.description}
                  </p>
                )}

                <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {chall.targetValue} {chall.scoringUnit}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                    <span style={{ textTransform: 'capitalize' }}>
                      {chall.challengeType.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                  <Calendar size={13} />
                  <span>
                    {new Date(chall.startAt).toLocaleDateString()} — {new Date(chall.endAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {chall.status === 'draft' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePublishChallenge(chall.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Send size={14} />
                    <span>Publish</span>
                  </button>
                )}

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleOpenLeaderboard(chall)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Eye size={14} />
                  <span>Leaderboard</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Challenge Modal */}
      {isCreateOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 1000,
          }}
        >
          <div
            className="card card-elevated animate-scale-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Trophy size={20} style={{ color: 'var(--accent-gold)' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Challenge</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Challenge Title *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g., 20-Day Iron Attendance Challenge"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  className="input"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Inspire your members to participate..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Type
                  </label>
                  <select
                    className="input"
                    value={formType}
                    onChange={e => handleTypeChange(e.target.value as GymChallengeType)}
                    style={{ width: '100%' }}
                  >
                    <option value="attendance_count">Attendance Count</option>
                    <option value="attendance_streak">Attendance Streak</option>
                    <option value="workout_count">Workout Count</option>
                    <option value="workout_volume">Volume (Weight Lifted)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target ({formScoringUnit})
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formTargetValue}
                    onChange={e => setFormTargetValue(Math.max(1, Number(e.target.value)))}
                    min={1}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Start Date *
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={formStartAt}
                    onChange={e => setFormStartAt(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    End Date *
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={formEndAt}
                    onChange={e => setFormEndAt(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Badge Name (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formRewardBadge}
                    onChange={e => setFormRewardBadge(e.target.value)}
                    placeholder="e.g. Iron Warrior"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    FitCoins Reward
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formRewardCoins}
                    onChange={e => setFormRewardCoins(Number(e.target.value))}
                    min={0}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={creating}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>{creating ? 'Creating...' : 'Create Draft'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaderboard Inspection Modal */}
      {selectedChallengeForLeaderboard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 1000,
          }}
        >
          <div
            className="card card-elevated animate-scale-in"
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Award size={16} />
                  <span>OFFICIAL FACILITY LEADERBOARD</span>
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedChallengeForLeaderboard.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Target: {selectedChallengeForLeaderboard.targetValue} {selectedChallengeForLeaderboard.scoringUnit}
                </p>
              </div>

              <button
                onClick={() => setSelectedChallengeForLeaderboard(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {loadingLeaderboard ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto', color: 'var(--accent-primary)' }} />
              </div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ margin: '0 auto var(--space-2)', opacity: 0.5 }} />
                <p>No participants have logged progress for this challenge yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {leaderboard.map(entry => (
                  <div
                    key={entry.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: entry.rank <= 3 ? 'rgba(255, 215, 0, 0.05)' : 'var(--bg-glass-card)',
                      borderRadius: 'var(--radius-md)',
                      border: entry.rank === 1 ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
                          background:
                            entry.rank === 1
                              ? '#fbbf24'
                              : entry.rank === 2
                              ? '#9ca3af'
                              : entry.rank === 3
                              ? '#d97706'
                              : 'var(--bg-card)',
                          color: entry.rank <= 3 ? '#000' : 'var(--text-muted)',
                        }}
                      >
                        {entry.rank}
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {entry.displayName || 'Gym Member'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {entry.currentScore} / {entry.targetValue} {entry.scoringUnit} ({Math.round(entry.progressPercentage)}%)
                        </div>
                      </div>
                    </div>

                    <div>
                      {entry.isCompleted ? (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} />
                          Completed
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
