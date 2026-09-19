import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  BellRing,
  Archive,
  Pin,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { useAuth } from '@/hooks/useAuth';
import { gymRepository } from '@/repositories/gym.repository';
import {
  GymAnnouncement,
  GymAnnouncementPriority,
} from '@/types/gym.types';
import { formatDate } from '@/utils/formatters';

export const OwnerAnnouncementsView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();
  const { session } = useAuth();
  const currentUserId = session?.user?.id || '';

  const [announcements, setAnnouncements] = useState<GymAnnouncement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formPriority, setFormPriority] = useState<GymAnnouncementPriority>('normal');
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [formExpiresAt, setFormExpiresAt] = useState<string>('');

  const loadAnnouncements = useCallback(async () => {
    if (!activeGym) return;
    try {
      setLoading(true);
      setError(null);
      const data = await gymRepository.fetchGymAnnouncements(activeGym.id, true);
      setAnnouncements(data);
    } catch {
      setError('Failed to load facility announcements');
    } finally {
      setLoading(false);
    }
  }, [activeGym]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym || !formTitle.trim() || !formContent.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const res = await gymRepository.createGymAnnouncement({
        gymId: activeGym.id,
        title: formTitle.trim(),
        content: formContent.trim(),
        priority: formPriority,
        isPinned: formIsPinned,
        status: 'published',
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        createdBy: currentUserId,
      });

      if (!res.success) {
        setError(res.error || 'Failed to publish announcement');
        return;
      }

      setSuccessMsg('Announcement published successfully!');
      setIsModalOpen(false);
      setFormTitle('');
      setFormContent('');
      setFormPriority('normal');
      setFormIsPinned(false);
      setFormExpiresAt('');
      await loadAnnouncements();
    } catch {
      setError('An error occurred while publishing the announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async (announcement: GymAnnouncement) => {
    try {
      const res = await gymRepository.updateGymAnnouncement(announcement.id, {
        gymId: announcement.gymId,
        isPinned: !announcement.isPinned,
      });
      if (res.success) {
        await loadAnnouncements();
      }
    } catch {
      setError('Failed to update pin status');
    }
  };

  const handleArchive = async (announcement: GymAnnouncement) => {
    try {
      const newStatus = announcement.status === 'archived' ? 'published' : 'archived';
      const res = await gymRepository.updateGymAnnouncement(announcement.id, {
        gymId: announcement.gymId,
        status: newStatus,
      });
      if (res.success) {
        await loadAnnouncements();
      }
    } catch {
      setError('Failed to update announcement status');
    }
  };

  const handleDelete = async (announcement: GymAnnouncement) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const res = await gymRepository.deleteGymAnnouncement(announcement.id, announcement.gymId);
      if (res.success) {
        await loadAnnouncements();
      }
    } catch {
      setError('Failed to delete announcement');
    }
  };

  const activeCount = announcements.filter(
    a => a.status === 'published' && (!a.expiresAt || new Date(a.expiresAt) > new Date())
  ).length;
  const archivedCount = announcements.filter(
    a => a.status === 'archived' || (a.expiresAt && new Date(a.expiresAt) <= new Date())
  ).length;

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Megaphone size={16} />
            <span>FACILITY BROADCASTS</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Announcements</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Broadcast operational notices, holiday schedules, and member alerts to all enrolled athletes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAnnouncements}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
            disabled={!activeGym}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--accent-fire)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-fire)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Broadcasts</span>
            <BellRing size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visible to active gym members</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pinned Notices</span>
            <Pin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {announcements.filter(a => a.isPinned && a.status === 'published').length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Featured on member home</div>
        </div>

        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Archived / Expired</span>
            <Archive size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{archivedCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Past notices history</div>
        </div>
      </div>

      {/* Announcements List */}
      {loadingGym || loading ? (
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto var(--space-2)', color: 'var(--accent-primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading facility broadcasts...</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <Megaphone size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>No Announcements Published</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto var(--space-4)' }}>
            Publish alerts about equipment maintenance, upcoming holidays, or special operating hours.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
            disabled={!activeGym}
          >
            Create First Announcement
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {announcements.map(item => {
            const isExpired = item.expiresAt && new Date(item.expiresAt) <= new Date();
            const isArchived = item.status === 'archived' || isExpired;

            let badgeBg = 'rgba(79, 140, 255, 0.15)';
            let badgeColor = 'var(--accent-primary)';
            if (item.priority === 'urgent') {
              badgeBg = 'rgba(239, 68, 68, 0.18)';
              badgeColor = 'var(--accent-fire)';
            } else if (item.priority === 'high') {
              badgeBg = 'rgba(245, 158, 11, 0.18)';
              badgeColor = 'var(--accent-gold)';
            }

            return (
              <div
                key={item.id}
                className="card card-elevated"
                style={{
                  padding: 'var(--space-5)',
                  borderRadius: 'var(--radius-md)',
                  background: item.isPinned
                    ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.06) 0%, var(--bg-surface) 100%)'
                    : 'var(--bg-surface)',
                  border: item.isPinned
                    ? '1px solid rgba(234, 179, 8, 0.35)'
                    : '1px solid var(--border-subtle)',
                  opacity: isArchived ? 0.75 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {item.isPinned && (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(234, 179, 8, 0.2)',
                          color: 'var(--accent-gold)',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Pin size={12} /> Pinned
                      </span>
                    )}

                    <span
                      className="badge"
                      style={{
                        background: badgeBg,
                        color: badgeColor,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.priority}
                    </span>

                    {isArchived && (
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(156, 163, 175, 0.2)',
                          color: 'var(--text-muted)',
                          fontSize: '0.72rem',
                        }}
                      >
                        {isExpired ? 'Expired' : 'Archived'}
                      </span>
                    )}

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                      {item.title}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleTogglePin(item)}
                      title={item.isPinned ? 'Unpin' : 'Pin to top'}
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Pin size={14} style={{ color: item.isPinned ? 'var(--accent-gold)' : 'inherit' }} />
                      <span style={{ fontSize: '0.8rem' }}>{item.isPinned ? 'Unpin' : 'Pin'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleArchive(item)}
                      title={item.status === 'archived' ? 'Unarchive' : 'Archive'}
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Archive size={14} />
                      <span style={{ fontSize: '0.8rem' }}>{item.status === 'archived' ? 'Publish' : 'Archive'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(item)}
                      title="Delete"
                      style={{ padding: '6px 10px', color: 'var(--accent-fire)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {item.content}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Published {formatDate(item.createdAt)}</span>
                  {item.expiresAt && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      Expires: {formatDate(item.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Announcement */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card card-elevated animate-fade-in"
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Megaphone size={20} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>New Gym Broadcast</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Holiday Schedule / New Squat Racks"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Notice Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Details for your gym members..."
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Priority Level
                  </label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as GymAnnouncementPriority)}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={e => setFormExpiresAt(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-1)' }}>
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={formIsPinned}
                  onChange={e => setFormIsPinned(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="pinNotice" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Pin notice to top of member feed
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Megaphone size={14} />}
                  <span>Publish Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
