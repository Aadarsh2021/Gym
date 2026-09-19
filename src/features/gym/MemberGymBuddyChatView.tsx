import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  ShieldAlert,
  UserX,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymChatService } from '@/services/gym-chat.service';
import { gymBuddyService } from '@/services/gym-buddy.service';
import {
  GymChatMessage,
  GymBuddyConnection,
  GymBuddyReportReason,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

export const MemberGymBuddyChatView: React.FC = () => {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentUserId = session?.user?.id;

  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }
  const activeGymId = memberGymCtx?.activeGym?.id;

  const [connection, setConnection] = useState<GymBuddyConnection | null>(null);
  const [messages, setMessages] = useState<GymChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Safety Modals
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<GymBuddyReportReason>('inappropriate_behavior');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyActionLoading, setSafetyActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 1. Fetch Connection Details & Messages
  const loadChat = useCallback(async () => {
    if (!connectionId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      // Load connections to find this one
      if (activeGymId && currentUserId) {
        const myConns = await gymBuddyService.getMyConnections(activeGymId, currentUserId);
        const match = myConns.find(c => c.id === connectionId);
        if (match) {
          setConnection(match);
        }
      }

      const history = await gymChatService.getMessages(connectionId, 100);
      setMessages(history);

      // Mark read
      await gymChatService.markAsRead(connectionId);
    } catch (err: any) {
      logger.error('Error loading chat', { err });
      setErrorMsg(err.message || 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [connectionId, activeGymId, currentUserId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // 2. Realtime Subscription
  useEffect(() => {
    if (!connectionId) return;

    const unsubscribe = gymChatService.subscribeToConnection(connectionId, (newMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // Mark as read if from peer
      if (newMsg.senderId !== currentUserId) {
        gymChatService.markAsRead(connectionId);
      }
      setTimeout(scrollToBottom, 50);
    });

    return () => {
      unsubscribe();
    };
  }, [connectionId, currentUserId, scrollToBottom]);

  // Auto-scroll on initial load and messages update
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, messages.length, scrollToBottom]);

  // 3. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionId || !inputText.trim() || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);
    setErrorMsg(null);

    try {
      const sent = await gymChatService.sendMessage(connectionId, textToSend);
      setMessages(prev => [...prev, sent]);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      logger.error('Failed to send chat message', { err });
      setErrorMsg(err.message || 'Failed to send message');
      setInputText(textToSend); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  // 4. Edit Message
  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    try {
      const updated = await gymChatService.editMessage(editingMessageId, editingContent.trim());
      setMessages(prev =>
        prev.map(m => (m.id === editingMessageId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m))
      );
      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to edit message');
    }
  };

  // 5. Delete Message
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await gymChatService.deleteMessage(msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete message');
    }
  };

  // 6. Safety Actions: Unmatch, Block, Report
  const peerUserId = connection
    ? connection.userAId === currentUserId
      ? connection.userBId
      : connection.userAId
    : null;

  const partnerName = connection?.partnerProfile?.displayName || 'Gym Buddy';

  const handleUnmatch = async () => {
    if (!connectionId) return;
    try {
      setSafetyActionLoading(true);
      await gymBuddyService.unmatch(connectionId);
      navigate('/app/gym/buddies');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to unmatch');
      setSafetyActionLoading(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!peerUserId) return;
    try {
      setSafetyActionLoading(true);
      await gymBuddyService.blockUser(peerUserId);
      navigate('/app/gym/buddies');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to block user');
      setSafetyActionLoading(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGymId || !peerUserId) return;
    try {
      setSafetyActionLoading(true);
      await gymBuddyService.reportUser(activeGymId, peerUserId, reportReason, reportDetails.trim() || undefined);
      setShowReportModal(false);
      navigate('/app/gym/buddies');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to report user');
      setSafetyActionLoading(false);
    }
  };

  const isConnectionActive = connection ? connection.status === 'accepted' : true;

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-4)', maxWidth: '900px', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Bar */}
      <div
        className="card"
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-glass-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            onClick={() => navigate('/app/gym/buddies')}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px' }}
            title="Back to Buddies"
            aria-label="Back to Buddies"
          >
            <ArrowLeft size={18} />
          </button>

          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--color-success)',
            }}
          >
            {connection?.partnerProfile?.avatarUrl ? (
              <img
                src={connection.partnerProfile.avatarUrl}
                alt=""
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              partnerName.charAt(0)
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {partnerName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnectionActive ? 'var(--color-success)' : 'var(--text-muted)' }} />
              {isConnectionActive ? 'Active Buddy Connection' : 'Connection Ended'}
            </div>
          </div>
        </div>

        {/* Action Menu Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px' }}
            aria-label="Options"
          >
            <MoreVertical size={18} />
          </button>

          {showActionMenu && (
            <div
              className="card"
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                minWidth: '160px',
                padding: 'var(--space-2)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <button
                onClick={() => {
                  setShowActionMenu(false);
                  setShowReportModal(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', color: 'var(--color-danger)', fontSize: '0.8rem' }}
              >
                <ShieldAlert size={14} style={{ marginRight: '6px' }} />
                Report Buddy
              </button>

              <button
                onClick={() => {
                  setShowActionMenu(false);
                  setShowBlockConfirm(true);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', color: 'var(--color-danger)', fontSize: '0.8rem' }}
              >
                <UserX size={14} style={{ marginRight: '6px' }} />
                Block Buddy
              </button>

              <button
                onClick={() => {
                  setShowActionMenu(false);
                  handleUnmatch();
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', color: 'var(--text-muted)', fontSize: '0.8rem' }}
              >
                <Lock size={14} style={{ marginRight: '6px' }} />
                Unmatch
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Error Banner */}
      {errorMsg && (
        <div
          className="card"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-danger)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: 'var(--space-2)',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Messages Feed */}
      <div
        className="card"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-glass-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-8)', fontSize: '0.85rem' }}>
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-8)', margin: 'auto' }}>
            <MessageSquare size={36} style={{ margin: '0 auto var(--space-3)', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No messages yet</div>
            <div style={{ fontSize: '0.8rem', maxWidth: '300px', margin: '4px auto 0' }}>
              Say hello to {partnerName}! Coordinate your next workout session.
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.senderId === currentUserId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  alignSelf: isMine ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isMine ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isMine ? '#FFFFFF' : 'var(--text-primary)',
                    border: isMine ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    position: 'relative',
                  }}
                >
                  {msg.content}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{timeStr}</span>
                  {msg.editedAt && <span>(edited)</span>}
                  {isMine && (
                    <span title={msg.readAt ? 'Read' : 'Sent'}>
                      {msg.readAt ? <CheckCheck size={12} color="var(--color-success)" /> : <Check size={12} />}
                    </span>
                  )}
                  {isMine && !msg.deletedAt && (
                    <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '6px' }}>
                      <button
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditingContent(msg.content);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        title="Edit"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Edit Message Modal */}
      {editingMessageId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Edit Message</h3>
            <textarea
              value={editingContent}
              onChange={e => setEditingContent(e.target.value)}
              maxLength={2000}
              rows={3}
              className="input"
              style={{ width: '100%', resize: 'none', marginBottom: 'var(--space-3)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button onClick={() => setEditingMessageId(null)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Inactive / Blocked Warning Banner */}
      {!isConnectionActive && (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-2)',
          }}
        >
          This buddy connection has ended. Messaging is disabled.
        </div>
      )}

      {/* 6. Input Send Box */}
      {isConnectionActive && (
        <form onSubmit={handleSendMessage} style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={`Message ${partnerName}...`}
            maxLength={2000}
            disabled={sending}
            className="input"
            style={{
              flex: 1,
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: '0.9rem',
            }}
          />

          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="btn btn-primary"
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={16} />
          </button>
        </form>
      )}

      {/* 7. Block Confirm Modal */}
      {showBlockConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: 'var(--space-5)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <UserX size={36} color="var(--color-danger)" style={{ margin: '0 auto var(--space-3)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Block {partnerName}?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Blocking will immediately terminate this connection, disable all messaging, and hide each other permanently.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
              <button onClick={() => setShowBlockConfirm(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={handleBlockConfirm} disabled={safetyActionLoading} className="btn btn-danger btn-sm">
                {safetyActionLoading ? 'Blocking...' : 'Yes, Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Report Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
        >
          <form
            onSubmit={handleReportSubmit}
            className="card"
            style={{ maxWidth: '460px', width: '100%', padding: 'var(--space-5)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>
              <ShieldAlert size={20} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Report {partnerName}</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Reports are sent directly to facility moderation. Private contact info is not exposed.
            </p>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Reason
              </label>
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value as GymBuddyReportReason)}
                className="input"
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="harassment">Harassment or Bullying</option>
                <option value="inappropriate_behavior">Inappropriate Behavior</option>
                <option value="unsolicited_contact">Unsolicited Contact</option>
                <option value="impersonation">Impersonation / Fake Profile</option>
                <option value="spam">Spam or Commercial Promotion</option>
                <option value="safety_concern">Safety Concern</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Additional Details (Optional)
              </label>
              <textarea
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe what occurred..."
                className="input"
                style={{ width: '100%', resize: 'none', padding: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button type="button" onClick={() => setShowReportModal(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={safetyActionLoading} className="btn btn-danger btn-sm">
                {safetyActionLoading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
