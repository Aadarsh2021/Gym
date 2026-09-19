import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  ShieldAlert,
  Pin,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  EyeOff,
  Check,
  X,
} from 'lucide-react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { gymRepository } from '@/repositories/gym.repository';
import {
  GymPost,
  GymPostReport,
  GymCommunityStats,
  GymPostStatus,
  GymCommentStatus,
  GymReportStatus,
} from '@/types/gym.types';
import { formatDate } from '@/utils/formatters';

export const OwnerCommunityView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  const [stats, setStats] = useState<GymCommunityStats>({
    activePostsCount: 0,
    pinnedPostsCount: 0,
    pendingReportsCount: 0,
  });

  const [activeTab, setActiveTab] = useState<'feed' | 'reports'>('feed');
  const [posts, setPosts] = useState<GymPost[]>([]);
  const [reports, setReports] = useState<GymPostReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Moderation Modal State
  const [modTargetPost, setModTargetPost] = useState<GymPost | null>(null);
  const [modReason, setModReason] = useState<string>('');
  const [modStatus, setModStatus] = useState<GymPostStatus | GymCommentStatus>('removed');
  const [submittingMod, setSubmittingMod] = useState<boolean>(false);

  // Report Resolution Modal State
  const [activeReport, setActiveReport] = useState<GymPostReport | null>(null);
  const [reportResolutionNotes, setReportResolutionNotes] = useState<string>('');
  const [reportResolutionStatus, setReportResolutionStatus] = useState<GymReportStatus>('action_taken');
  const [submittingResolution, setSubmittingResolution] = useState<boolean>(false);

  // Pin action in progress
  const [pinningPostId, setPinningPostId] = useState<string | null>(null);

  const loadCommunityData = useCallback(async (isInitial = false) => {
    if (!activeGym) return;

    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [statsData, postsRes, reportsData] = await Promise.all([
        gymRepository.fetchGymCommunityStats(activeGym.id),
        gymRepository.fetchGymPosts(activeGym.id, { limit: 50, includeAllStatuses: true }),
        gymRepository.fetchGymReports(activeGym.id),
      ]);

      setStats(statsData);
      setPosts(postsRes.posts);
      setReports(reportsData);
    } catch {
      setError('Failed to load community moderation data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeGym]);

  useEffect(() => {
    loadCommunityData(true);
  }, [loadCommunityData]);

  // Pin / Unpin
  const handleTogglePin = async (post: GymPost) => {
    if (!activeGym) return;
    try {
      setPinningPostId(post.id);
      setError(null);

      const nextPinned = !post.isPinned;
      const res = await gymRepository.pinGymPost(post.id, nextPinned, activeGym.id);

      if (!res.success) {
        setError(res.error || 'Failed to update pin status');
        return;
      }

      setPosts(prev =>
        prev.map(p => (p.id === post.id ? { ...p, isPinned: nextPinned } : p))
      );
      setStats(prev => ({
        ...prev,
        pinnedPostsCount: nextPinned ? prev.pinnedPostsCount + 1 : Math.max(0, prev.pinnedPostsCount - 1),
      }));
      setSuccessMsg(nextPinned ? 'Post pinned to top of member feed' : 'Post unpinned');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Exception setting pin status');
    } finally {
      setPinningPostId(null);
    }
  };

  // Moderate Post (Hide, Remove, or Restore to Published)
  const handleModeratePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym || !modTargetPost) return;

    try {
      setSubmittingMod(true);
      setError(null);

      const res = await gymRepository.moderateGymPost(
        modTargetPost.id,
        modStatus as GymPostStatus,
        modReason.trim() || undefined,
        activeGym.id
      );

      if (!res.success) {
        setError(res.error || 'Moderation action failed');
        return;
      }

      setPosts(prev =>
        prev.map(p =>
          p.id === modTargetPost.id
            ? {
                ...p,
                status: modStatus as GymPostStatus,
                moderationReason: modReason.trim() || null,
                isPinned: modStatus !== 'published' ? false : p.isPinned,
              }
            : p
        )
      );

      setModTargetPost(null);
      setModReason('');
      setSuccessMsg(`Post status updated to ${modStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadCommunityData(false);
    } catch {
      setError('Exception moderating post');
    } finally {
      setSubmittingMod(false);
    }
  };

  // Resolve Report
  const handleResolveReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym || !activeReport) return;

    try {
      setSubmittingResolution(true);
      setError(null);

      const res = await gymRepository.resolveGymReport(
        activeReport.id,
        reportResolutionStatus as 'reviewed' | 'dismissed' | 'action_taken',
        reportResolutionNotes.trim() || undefined,
        activeGym.id
      );

      if (!res.success) {
        setError(res.error || 'Failed to resolve report');
        return;
      }

      // If action_taken, also moderate target if selected
      if (reportResolutionStatus === 'action_taken') {
        if (activeReport.targetType === 'post' && activeReport.postId) {
          await gymRepository.moderateGymPost(activeReport.postId, 'removed', `Report action: ${reportResolutionNotes || activeReport.reason}`, activeGym.id);
        } else if (activeReport.targetType === 'comment' && activeReport.commentId) {
          await gymRepository.moderateGymComment(activeReport.commentId, 'removed', `Report action: ${reportResolutionNotes || activeReport.reason}`);
        }
      }

      setReports(prev =>
        prev.map(r =>
          r.id === activeReport.id
            ? {
                ...r,
                status: reportResolutionStatus,
                resolutionNotes: reportResolutionNotes.trim() || null,
                reviewedAt: new Date().toISOString(),
              }
            : r
        )
      );

      setActiveReport(null);
      setReportResolutionNotes('');
      setSuccessMsg(`Report marked as ${reportResolutionStatus}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadCommunityData(false);
    } catch {
      setError('Exception resolving report');
    } finally {
      setSubmittingResolution(false);
    }
  };

  if (loadingGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px', textAlign: 'center' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-3)' }} />
        <div>Loading gym console...</div>
      </div>
    );
  }

  if (!activeGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '800px', textAlign: 'center' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)' }}>
          <ShieldAlert size={40} style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-3)' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>No Active Gym Found</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please select or register a gym to manage its community board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <MessageSquare size={16} />
            <span>MODERATION & FEED • {activeGym.name.toUpperCase()}</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Community Moderation Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 'var(--space-1) 0 0' }}>
            Authoritative moderation for intra-gym discussions, pinned notices (max 3), and member reports.
          </p>
        </div>

        <button
          onClick={() => loadCommunityData(false)}
          disabled={refreshing || loading}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            color: '#4ade80',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Live Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Posts</span>
            <MessageSquare size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.activePostsCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Published intra-gym discussions</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pinned Topics</span>
            <Pin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {stats.pinnedPostsCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 3 max</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Promoted top notices</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: stats.pendingReportsCount > 0 ? 'var(--color-danger)' : 'var(--color-success)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Reports</span>
            <ShieldAlert size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.pendingReportsCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {stats.pendingReportsCount > 0 ? 'Requires owner triage' : 'Clean moderation queue'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <button
          onClick={() => setActiveTab('feed')}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'feed' ? '2px solid var(--accent-gold)' : '2px solid transparent',
            color: activeTab === 'feed' ? 'var(--accent-gold)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <MessageSquare size={16} />
          <span>Feed & Content Management ({posts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '2px solid var(--accent-gold)' : '2px solid transparent',
            color: activeTab === 'reports' ? 'var(--accent-gold)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <ShieldAlert size={16} />
          <span>Moderation Queue ({reports.filter(r => r.status === 'pending').length} pending)</span>
        </button>
      </div>

      {/* Tab 1: Feed Management */}
      {activeTab === 'feed' && (
        <div>
          {loading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
              <div>Loading facility posts...</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <MessageSquare size={36} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>No Community Posts Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No members have posted in {activeGym.name} yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {posts.map(post => {
                const isPinned = post.isPinned;
                const isRemoved = post.status === 'removed';

                return (
                  <div
                    key={post.id}
                    className="card card-elevated"
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: isPinned ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                      opacity: isRemoved ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{post.author?.displayName || 'Member'}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(post.createdAt)}</span>

                        {isPinned && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(212, 175, 55, 0.2)',
                              color: 'var(--accent-gold)',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Pin size={10} /> PINNED
                          </span>
                        )}

                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: post.status === 'published' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: post.status === 'published' ? '#4ade80' : '#f87171',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {post.status}
                        </span>
                      </div>

                      {/* Moderation Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {post.status === 'published' && (
                          <button
                            onClick={() => handleTogglePin(post)}
                            disabled={pinningPostId === post.id}
                            className="btn btn-secondary"
                            style={{
                              padding: 'var(--space-1) var(--space-3)',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isPinned ? 'var(--accent-gold)' : 'var(--text-muted)',
                            }}
                            title={isPinned ? 'Unpin post' : 'Pin post to top (max 3)'}
                          >
                            <Pin size={12} />
                            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setModTargetPost(post);
                            setModStatus(post.status === 'published' ? 'removed' : 'published');
                            setModReason(post.moderationReason || '');
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: 'var(--space-1) var(--space-3)',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: post.status === 'published' ? 'var(--color-danger)' : 'var(--color-success)',
                          }}
                        >
                          {post.status === 'published' ? <EyeOff size={12} /> : <Check size={12} />}
                          <span>{post.status === 'published' ? 'Moderate' : 'Restore'}</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                      {post.content}
                    </div>

                    {post.moderationReason && (
                      <div style={{ fontSize: '0.75rem', color: '#f87171', fontStyle: 'italic' }}>
                        Moderation reason: {post.moderationReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Moderation Queue */}
      {activeTab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-3)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>Moderation Queue Empty</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                There are no pending user reports requiring review.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {reports.map(report => {
                const isPending = report.status === 'pending';

                return (
                  <div
                    key={report.id}
                    className="card card-elevated"
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: isPending ? '4px solid var(--color-danger)' : '4px solid var(--color-success)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            {report.reason}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            Target: {report.targetType.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Reported {formatDate(report.createdAt)} by {report.reporter?.displayName || 'Member'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isPending ? '#f87171' : '#4ade80',
                            textTransform: 'uppercase',
                          }}
                        >
                          Status: {report.status}
                        </span>

                        {isPending && (
                          <button
                            onClick={() => {
                              setActiveReport(report);
                              setReportResolutionStatus('action_taken');
                              setReportResolutionNotes('');
                            }}
                            className="btn btn-primary"
                            style={{ padding: 'var(--space-1) var(--space-3)', fontSize: '0.75rem' }}
                          >
                            Triage Report
                          </button>
                        )}
                      </div>
                    </div>

                    {report.details && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                        <strong>Reporter Notes:</strong> &ldquo;{report.details}&rdquo;
                      </div>
                    )}

                    {/* Target Content Preview */}
                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '2px' }}>
                        Reported Content:
                      </div>
                      {report.targetPost ? (
                        <div>
                          <div>{report.targetPost.content}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Post status: {report.targetPost.status}
                          </div>
                        </div>
                      ) : report.targetComment ? (
                        <div>
                          <div>{report.targetComment.content}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Comment status: {report.targetComment.status}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          Target content has been permanently removed or not cached.
                        </span>
                      )}
                    </div>

                    {report.resolutionNotes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: 'var(--space-2)' }}>
                        Resolution notes: {report.resolutionNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Moderate Post Modal */}
      {modTargetPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div className="card card-elevated animate-scale-up" style={{ width: '100%', maxWidth: '440px', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Moderate Gym Post</h3>
              <button onClick={() => setModTargetPost(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModeratePostSubmit}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  New Status
                </label>
                <select
                  value={modStatus}
                  onChange={e => setModStatus(e.target.value as GymPostStatus)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="removed">Removed (Hidden from members)</option>
                  <option value="hidden">Hidden (Soft-deleted)</option>
                  <option value="published">Published (Restore to feed)</option>
                </select>
              </div>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Moderation Reason (Recorded in audit trail)
                </label>
                <textarea
                  value={modReason}
                  onChange={e => setModReason(e.target.value)}
                  placeholder="Explain why this moderation action was taken..."
                  rows={3}
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setModTargetPost(null)}
                  disabled={submittingMod}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMod}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {submittingMod ? 'Applying...' : 'Apply Moderation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage / Resolve Report Modal */}
      {activeReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div className="card card-elevated animate-scale-up" style={{ width: '100%', maxWidth: '440px', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)' }}>
                <ShieldAlert size={18} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Triage Report</h3>
              </div>
              <button onClick={() => setActiveReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveReportSubmit}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Resolution Action
                </label>
                <select
                  value={reportResolutionStatus}
                  onChange={e => setReportResolutionStatus(e.target.value as GymReportStatus)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="action_taken">Action Taken (Remove content & resolve)</option>
                  <option value="dismissed">Dismiss (Content complies with rules)</option>
                  <option value="reviewed">Reviewed (Mark reviewed without removal)</option>
                </select>
              </div>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Resolution Notes
                </label>
                <textarea
                  value={reportResolutionNotes}
                  onChange={e => setReportResolutionNotes(e.target.value)}
                  placeholder="Document the resolution rationale..."
                  rows={3}
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  disabled={submittingResolution}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  {submittingResolution ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
