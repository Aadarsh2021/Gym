import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Pin,
  Send,
  Trash2,
  Edit2,
  AlertTriangle,
  Flag,
  CheckCircle2,
  RefreshCw,
  Snowflake,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymRepository } from '@/repositories/gym.repository';
import {
  GymPost,
  GymComment,
  GymReportReason,
} from '@/types/gym.types';
import { formatDate } from '@/utils/formatters';

export const MemberGymCommunityView: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id || '';
  const userDisplayName =
    session?.profile?.displayName ||
    session?.user?.email?.split('@')[0] ||
    'Member';

  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymCtx = useMemberGymContext();
  } catch {
    // Graceful fallback for environments without provider
  }

  const activeGym = memberGymCtx?.activeGym;
  const activeMembership = memberGymCtx?.activeMembership;
  const gymMode = memberGymCtx?.mode;
  const membershipStatus = activeMembership?.status;

  const isActive = membershipStatus === 'active';
  const isFrozen = membershipStatus === 'frozen';
  const hasAccess = isActive || isFrozen;

  // Feed State
  const [posts, setPosts] = useState<GymPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // New Post State
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [posting, setPosting] = useState<boolean>(false);

  // Editing Post State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState<string>('');
  const [updatingPost, setUpdatingPost] = useState<boolean>(false);

  // Comments State (keyed by postId)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, GymComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [commenting, setCommenting] = useState<Record<string, boolean>>({});

  // Editing Comment State
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState<string>('');
  const [updatingComment, setUpdatingComment] = useState<boolean>(false);

  // Reporting State
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'comment';
    id: string;
    postId?: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<GymReportReason>('inappropriate');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load Posts
  const loadPosts = useCallback(async (isInitial = false) => {
    if (!activeGym?.id || !hasAccess) {
      setLoading(false);
      return;
    }

    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const res = await gymRepository.fetchGymPosts(activeGym.id, { limit: 20 });
      setPosts(res.posts);
      setNextCursor(res.nextCursor);
    } catch {
      setError('Failed to load community feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeGym?.id, hasAccess]);

  useEffect(() => {
    loadPosts(true);
  }, [loadPosts]);

  // Load More Posts
  const handleLoadMore = async () => {
    if (!activeGym?.id || !nextCursor) return;
    try {
      const res = await gymRepository.fetchGymPosts(activeGym.id, {
        limit: 20,
        cursor: nextCursor,
      });
      setPosts(prev => [...prev, ...res.posts]);
      setNextCursor(res.nextCursor);
    } catch {
      setError('Failed to load older posts');
    }
  };

  // Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isActive || !activeGym?.id || !userId) return;

    const trimmed = newPostContent.trim();
    if (!trimmed) {
      setError('Post content cannot be empty');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Post content exceeds 2000 characters limit');
      return;
    }

    try {
      setPosting(true);
      setError(null);
      const res = await gymRepository.createGymPost({
        gymId: activeGym.id,
        authorId: userId,
        content: trimmed,
        authorName: userDisplayName,
      });

      if (!res.success || !res.post) {
        setError(res.error || 'Failed to create post');
        return;
      }

      setNewPostContent('');
      setPosts(prev => [res.post!, ...prev]);
      setSuccessMsg('Post published to gym feed');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Exception while posting');
    } finally {
      setPosting(false);
    }
  };

  // Start Editing Post
  const handleStartEditPost = (post: GymPost) => {
    setEditingPostId(post.id);
    setEditingPostContent(post.content);
  };

  // Save Post Edit
  const handleSaveEditPost = async (postId: string) => {
    if (!isActive || !userId) return;
    const trimmed = editingPostContent.trim();
    if (!trimmed) {
      setError('Post content cannot be empty');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Post content exceeds 2000 characters limit');
      return;
    }

    try {
      setUpdatingPost(true);
      setError(null);
      const res = await gymRepository.updateGymPost({
        id: postId,
        authorId: userId,
        content: trimmed,
        gymId: activeGym?.id,
      });

      if (!res.success || !res.post) {
        setError(res.error || 'Failed to update post');
        return;
      }

      setPosts(prev => prev.map(p => (p.id === postId ? { ...p, content: trimmed, updatedAt: res.post!.updatedAt } : p)));
      setEditingPostId(null);
      setEditingPostContent('');
      setSuccessMsg('Post updated successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Failed to update post');
    } finally {
      setUpdatingPost(false);
    }
  };

  // Delete Post (Soft-delete)
  const handleDeletePost = async (postId: string) => {
    if (!isActive || !userId) return;
    if (!window.confirm('Are you sure you want to remove this post?')) return;

    try {
      setError(null);
      const res = await gymRepository.deleteGymPost({
        id: postId,
        authorId: userId,
        gymId: activeGym?.id,
      });

      if (!res.success) {
        setError(res.error || 'Failed to delete post');
        return;
      }

      setPosts(prev => prev.filter(p => p.id !== postId));
      setSuccessMsg('Post removed');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Failed to delete post');
    }
  };

  // Toggle Comments & Fetch Comments
  const handleToggleComments = async (postId: string) => {
    const isCurrentlyExpanded = !!expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: !isCurrentlyExpanded }));

    if (!isCurrentlyExpanded && !commentsMap[postId]) {
      try {
        setLoadingComments(prev => ({ ...prev, [postId]: true }));
        const comments = await gymRepository.fetchGymComments(postId);
        setCommentsMap(prev => ({ ...prev, [postId]: comments }));
      } catch {
        setError('Failed to load comments');
      } finally {
        setLoadingComments(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Create Comment
  const handleCreateComment = async (postId: string) => {
    if (!isActive || !activeGym?.id || !userId) return;
    const content = newCommentContent[postId]?.trim();
    if (!content) return;
    if (content.length > 1000) {
      setError('Comment content exceeds 1000 characters limit');
      return;
    }

    try {
      setCommenting(prev => ({ ...prev, [postId]: true }));
      setError(null);
      const res = await gymRepository.createGymComment({
        postId,
        gymId: activeGym.id,
        authorId: userId,
        content,
        authorName: userDisplayName,
      });

      if (!res.success || !res.comment) {
        setError(res.error || 'Failed to post comment');
        return;
      }

      setNewCommentContent(prev => ({ ...prev, [postId]: '' }));
      setCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.comment!],
      }));
    } catch {
      setError('Failed to create comment');
    } finally {
      setCommenting(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Start Editing Comment
  const handleStartEditComment = (comment: GymComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  // Save Edit Comment
  const handleSaveEditComment = async (commentId: string, postId: string) => {
    if (!isActive || !userId) return;
    const trimmed = editingCommentContent.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      setError('Comment exceeds 1000 characters limit');
      return;
    }

    try {
      setUpdatingComment(true);
      setError(null);
      const res = await gymRepository.updateGymComment({
        id: commentId,
        authorId: userId,
        content: trimmed,
        postId,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update comment');
        return;
      }

      setCommentsMap(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c =>
          c.id === commentId ? { ...c, content: trimmed, updatedAt: new Date().toISOString() } : c
        ),
      }));
      setEditingCommentId(null);
      setEditingCommentContent('');
    } catch {
      setError('Failed to update comment');
    } finally {
      setUpdatingComment(false);
    }
  };

  // Delete Comment (Soft-delete)
  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!isActive || !userId) return;
    if (!window.confirm('Delete this comment?')) return;

    try {
      setError(null);
      const res = await gymRepository.deleteGymComment({
        id: commentId,
        authorId: userId,
        postId,
      });

      if (!res.success) {
        setError(res.error || 'Failed to delete comment');
        return;
      }

      setCommentsMap(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
      }));
    } catch {
      setError('Failed to delete comment');
    }
  };

  // Open Report Modal
  const handleOpenReport = (type: 'post' | 'comment', id: string, postId?: string) => {
    if (!isActive) return;
    setReportTarget({ type, id, postId });
    setReportReason('inappropriate');
    setReportDetails('');
    setReportError(null);
  };

  // Submit Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isActive || !activeGym?.id || !userId || !reportTarget) return;

    try {
      setSubmittingReport(true);
      setReportError(null);

      const res = await gymRepository.reportGymContent({
        gymId: activeGym.id,
        targetType: reportTarget.type,
        postId: reportTarget.type === 'post' ? reportTarget.id : reportTarget.postId,
        commentId: reportTarget.type === 'comment' ? reportTarget.id : undefined,
        reporterId: userId,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });

      if (!res.success) {
        setReportError(res.error || 'Failed to submit report');
        return;
      }

      setReportTarget(null);
      setSuccessMsg('Report submitted to gym moderation team');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setReportError('Exception while submitting report');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Access check guards
  if (!activeGym || gymMode !== 'integrated' || !activeMembership) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '800px', textAlign: 'center' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)' }}>
          <MessageSquare size={44} style={{ color: 'var(--accent-gold)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            Connected Gym Community
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto var(--space-6)' }}>
            You need an active or frozen membership at a registered partner gym to access its community board.
          </p>
          <a href="/app/gym/discovery" className="btn btn-primary">
            Discover Partner Gyms
          </a>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '800px' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <ShieldAlert size={40} style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-3)' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            Membership Pending or Inactive
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto' }}>
            Your membership at {activeGym.name} is currently <strong>{membershipStatus}</strong>.
            Community access is reserved for active or frozen members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)', maxWidth: '840px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <MessageSquare size={16} />
            <span>{activeGym.name} • Community</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 'var(--space-1) 0 0' }}>
            Member Discussions
          </h1>
        </div>

        <button
          onClick={() => loadPosts(false)}
          disabled={refreshing || loading}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem' }}
          title="Refresh Feed"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Frozen Read-Only Banner */}
      {isFrozen && (
        <div
          className="card"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginBottom: 'var(--space-4)',
            background: 'rgba(56, 189, 248, 0.08)',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Snowflake size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <strong>Membership Frozen:</strong> You have read-only access to view community posts. Creating posts, adding comments, and reporting are disabled.
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
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

      {/* New Post Creator (Active Members Only) */}
      {isActive && (
        <div className="card card-elevated" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
          <form onSubmit={handleCreatePost}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-gold)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Share an update or question</span>
            </div>

            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="What's on your mind? Share workout tips, ask questions, or share fitness progress..."
              rows={3}
              maxLength={2000}
              disabled={posting}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                resize: 'vertical',
                outline: 'none',
                marginBottom: 'var(--space-2)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {newPostContent.length}/2000 characters
              </span>
              <button
                type="submit"
                disabled={posting || !newPostContent.trim()}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem' }}
              >
                <Send size={14} />
                <span>{posting ? 'Posting...' : 'Post'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feed List */}
      {loading ? (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)' }} />
          <div>Loading community feed...</div>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
          <MessageSquare size={36} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>No posts yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {isActive ? 'Be the first member to start a discussion in this gym!' : 'No community posts found for this facility.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {posts.map(post => {
            const isAuthor = post.authorId === userId;
            const isEditing = editingPostId === post.id;
            const comments = commentsMap[post.id] || [];
            const isExpanded = !!expandedComments[post.id];
            const isLoadingPostComments = !!loadingComments[post.id];

            return (
              <div
                key={post.id}
                className="card card-elevated"
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: post.isPinned ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)',
                  background: post.isPinned ? 'linear-gradient(180deg, rgba(212, 175, 55, 0.05) 0%, var(--bg-glass-card) 100%)' : 'var(--bg-glass-card)',
                }}
              >
                {/* Pinned Notice Header */}
                {post.isPinned && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--accent-gold)', fontSize: '0.75rem', fontWeight: 700, marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                    <Pin size={12} />
                    <span>PINNED BY GYM OWNER</span>
                  </div>
                )}

                {/* Author & Actions Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: post.isPinned ? 'var(--accent-gold)' : 'var(--bg-glass)',
                        color: post.isPinned ? '#000' : 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {post.author?.displayName?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        {post.author?.displayName || 'Gym Member'}
                        {isAuthor && <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginLeft: 'var(--space-2)' }}>(You)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDate(post.createdAt)}
                        {post.updatedAt !== post.createdAt && ' • (edited)'}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Active members only) */}
                  {isActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {isAuthor ? (
                        <>
                          <button
                            onClick={() => handleStartEditPost(post)}
                            disabled={isEditing}
                            className="btn btn-secondary"
                            style={{ padding: 'var(--space-1) var(--space-2)', fontSize: '0.75rem' }}
                            title="Edit Post"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="btn btn-secondary"
                            style={{ padding: 'var(--space-1) var(--space-2)', fontSize: '0.75rem', color: 'var(--color-danger)' }}
                            title="Delete Post"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenReport('post', post.id)}
                          className="btn btn-secondary"
                          style={{ padding: 'var(--space-1) var(--space-2)', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                          title="Report Post"
                        >
                          <Flag size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content: Plain text rendering */}
                {isEditing ? (
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <textarea
                      value={editingPostContent}
                      onChange={e => setEditingPostContent(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      style={{
                        width: '100%',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        marginBottom: 'var(--space-2)',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: 'var(--space-1) var(--space-3)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEditPost(post.id)}
                        disabled={updatingPost || !editingPostContent.trim()}
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: 'var(--space-1) var(--space-3)' }}
                      >
                        {updatingPost ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.92rem',
                      lineHeight: '1.55',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    {post.content}
                  </div>
                )}

                {/* Comments Toggle */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="btn btn-secondary"
                    style={{
                      padding: 'var(--space-1) var(--space-3)',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      background: 'transparent',
                      border: 'none',
                    }}
                  >
                    <MessageCircle size={15} />
                    <span>
                      {isExpanded ? 'Hide Comments' : `Comments ${comments.length ? `(${comments.length})` : ''}`}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Collapsible Comments Section */}
                {isExpanded && (
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--border-color)' }}>
                    {isLoadingPostComments ? (
                      <div style={{ padding: 'var(--space-3)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Loading comments...
                      </div>
                    ) : comments.length === 0 ? (
                      <div style={{ padding: 'var(--space-2) 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No comments yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                        {comments.map(c => {
                          const isCommentAuthor = c.authorId === userId;
                          const isCommentEditing = editingCommentId === c.id;

                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                  {c.author?.displayName || 'Member'}
                                  {isCommentAuthor && <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginLeft: '4px' }}>(You)</span>}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                                    {formatDate(c.createdAt)}
                                  </span>
                                </span>

                                {isActive && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                    {isCommentAuthor ? (
                                      <>
                                        <button
                                          onClick={() => handleStartEditComment(c)}
                                          disabled={isCommentEditing}
                                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                          title="Edit"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(c.id, post.id)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px' }}
                                          title="Delete"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenReport('comment', c.id, post.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                        title="Report"
                                      >
                                        <Flag size={12} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {isCommentEditing ? (
                                <div style={{ marginTop: 'var(--space-1)' }}>
                                  <input
                                    type="text"
                                    value={editingCommentContent}
                                    onChange={e => setEditingCommentContent(e.target.value)}
                                    maxLength={1000}
                                    style={{
                                      width: '100%',
                                      padding: 'var(--space-1) var(--space-2)',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'var(--bg-card)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.85rem',
                                      outline: 'none',
                                      marginBottom: 'var(--space-1)',
                                    }}
                                  />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                                    <button
                                      onClick={() => setEditingCommentId(null)}
                                      className="btn btn-secondary"
                                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveEditComment(c.id, post.id)}
                                      disabled={updatingComment || !editingCommentContent.trim()}
                                      className="btn btn-primary"
                                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {c.content}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* New Comment Input (Active Members Only) */}
                    {isActive && (
                      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Write a comment (plain text)..."
                          value={newCommentContent[post.id] || ''}
                          onChange={e => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                          maxLength={1000}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleCreateComment(post.id);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleCreateComment(post.id)}
                          disabled={commenting[post.id] || !newCommentContent[post.id]?.trim()}
                          className="btn btn-primary"
                          style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.8rem' }}
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Load More Posts */}
          {nextCursor && (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
              <button onClick={handleLoadMore} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                Load Older Posts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Report Content Modal */}
      {reportTarget && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-danger)' }}>
                <Flag size={18} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Report {reportTarget.type === 'post' ? 'Post' : 'Comment'}</h3>
              </div>
              <button
                onClick={() => setReportTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {reportError && (
              <div
                className="card"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  marginBottom: 'var(--space-3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.8rem',
                }}
              >
                {reportError}
              </div>
            )}

            <form onSubmit={handleSubmitReport}>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Reason for reporting
                </label>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value as GymReportReason)}
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
                  <option value="spam">Spam / Advertising</option>
                  <option value="harassment">Harassment / Bullying</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="hate_speech">Hate Speech</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Additional details (optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Explain why this content violates community guidelines..."
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
                  onClick={() => setReportTarget(null)}
                  disabled={submittingReport}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="btn btn-primary"
                  style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)', fontSize: '0.85rem' }}
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
