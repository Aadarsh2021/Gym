import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { ownerDashboardService } from '@/services/owner-dashboard.service';
import { GymMembership, GymMembershipStatus } from '@/types/gym.types';
import { formatVisitDateIST } from '@/utils/date';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  PlusCircle,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerMembersView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  // Filter & Pagination state
  const [selectedStatus, setSelectedStatus] = useState<GymMembershipStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  // Data state
  const [members, setMembers] = useState<GymMembership[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [counts, setCounts] = useState<{ active: number; pending: number; inactive: number; total: number }>({
    active: 0,
    pending: 0,
    inactive: 0,
    total: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Mutation & Feedback state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    membership: GymMembership;
    targetStatus: GymMembershipStatus;
    title: string;
    description: string;
    buttonLabel: string;
    buttonColor: string;
  } | null>(null);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch Member Roster & Counts
  const loadRosterData = useCallback(async (isManualRefresh = false) => {
    if (!activeGym?.id) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await ownerDashboardService.getMemberRoster(activeGym.id, {
        status: selectedStatus,
        search: searchQuery.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      if (!isMountedRef.current) return;

      setMembers(res.members);
      setTotalCount(res.totalCount);
      setCounts(res.counts);
    } catch (err) {
      if (!isMountedRef.current) return;
      setFeedback({
        type: 'error',
        message: 'Failed to retrieve member roster. Please try again.',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeGym?.id, selectedStatus, searchQuery, page]);

  useEffect(() => {
    loadRosterData();
  }, [loadRosterData]);

  // Handle status mutation
  const handleExecuteStatusChange = async (
    membership: GymMembership,
    targetStatus: GymMembershipStatus
  ) => {
    if (!activeGym?.id) return;
    setActionLoadingId(membership.id);
    setConfirmModal(null);
    setFeedback(null);

    try {
      const res = await ownerDashboardService.updateMembershipStatus(
        membership.id,
        activeGym.id,
        membership.status,
        targetStatus
      );

      if (!isMountedRef.current) return;

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully updated membership for ${membership.userProfile?.displayName || 'athlete'} to ${targetStatus.toUpperCase()}.`,
        });
        await loadRosterData(true);
      } else {
        setFeedback({
          type: 'error',
          message: res.error || `Failed to update membership to ${targetStatus}.`,
        });
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Action failed';
      setFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      if (isMountedRef.current) {
        setActionLoadingId(null);
      }
    }
  };

  const openConfirmation = (membership: GymMembership, targetStatus: GymMembershipStatus) => {
    const athleteName = membership.userProfile?.displayName || 'Athlete';
    if (targetStatus === 'active' && membership.status === 'pending') {
      setConfirmModal({
        membership,
        targetStatus,
        title: 'Approve Membership Request',
        description: `Are you sure you want to approve ${athleteName}'s membership application for ${activeGym?.name}? They will gain immediate check-in access.`,
        buttonLabel: 'Approve Pass',
        buttonColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      });
    } else if (targetStatus === 'frozen' && membership.status === 'active') {
      setConfirmModal({
        membership,
        targetStatus,
        title: 'Freeze Membership',
        description: `Temporarily freeze ${athleteName}'s pass? They will not be able to check in until the membership is unfrozen.`,
        buttonLabel: 'Freeze Membership',
        buttonColor: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      });
    } else if (targetStatus === 'active' && membership.status === 'frozen') {
      setConfirmModal({
        membership,
        targetStatus,
        title: 'Unfreeze Membership',
        description: `Reactivate ${athleteName}'s frozen pass and restore check-in privileges?`,
        buttonLabel: 'Unfreeze & Reactivate',
        buttonColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      });
    } else if (targetStatus === 'inactive') {
      setConfirmModal({
        membership,
        targetStatus,
        title: 'Deactivate Membership',
        description: `Deactivate ${athleteName}'s membership pass? They will lose access to ${activeGym?.name} until re-enrolled.`,
        buttonLabel: 'Deactivate Pass',
        buttonColor: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
      });
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: GymMembershipStatus) => {
    switch (status) {
      case 'active':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={12} />
            ACTIVE
          </span>
        );
      case 'pending':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(214, 168, 79, 0.2)',
              color: 'var(--accent-gold)',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(214, 168, 79, 0.4)',
            }}
          >
            <Clock size={12} />
            PENDING APPROVAL
          </span>
        );
      case 'frozen':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60A5FA',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <PauseCircle size={12} />
            FROZEN
          </span>
        );
      case 'inactive':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px solid rgba(148, 163, 184, 0.3)',
            }}
          >
            <UserX size={12} />
            INACTIVE
          </span>
        );
      default:
        return null;
    }
  };

  // Loading State
  if (loadingGym) {
    return (
      <div
        className="container animate-fade-in"
        style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Loading facility members...
        </div>
      </div>
    );
  }

  // Owner without registered gym
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
            To manage member rosters, review join requests, and control membership statuses, register your gym location.
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div
      className="container animate-fade-in"
      style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}
    >
      {/* HEADER */}
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
            <Users size={16} />
            <span>FACILITY MEMBER ROSTER</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
            {activeGym.name} Members
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Authoritative member directory, access approvals, and lifecycle status management.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            onClick={() => loadRosterData(true)}
            disabled={isRefreshing || loading}
            className="btn btn-outline btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-glass-card)',
              color: 'var(--text-primary)',
              cursor: isRefreshing || loading ? 'not-allowed' : 'pointer',
            }}
            title="Refresh Member Roster"
          >
            <RefreshCw
              size={15}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <div
          className="animate-fade-in"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            background:
              feedback.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border:
              feedback.type === 'success'
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
            color: feedback.type === 'success' ? '#10B981' : '#EF4444',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* TOP METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Active Members Card */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#10B981',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Members</span>
            <UserCheck size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981' }}>
            {counts.active}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Authorized check-in access
          </div>
        </div>

        {/* Pending Requests Card */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
            border: counts.pending > 0 ? '1px solid rgba(214, 168, 79, 0.4)' : '1px solid var(--border-subtle)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {counts.pending > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'var(--accent-gold)',
                color: '#000',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderBottomLeftRadius: 'var(--radius-sm)',
              }}
            >
              NEEDS REVIEW
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--accent-gold)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Approval</span>
            <Clock size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
            {counts.pending}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Awaiting owner verification
          </div>
        </div>

        {/* Inactive Members Card */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#94A3B8',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Inactive / Frozen</span>
            <UserX size={20} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#94A3B8' }}>
            {counts.inactive}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Expired or paused athletes
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-glass-card)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {(
            [
              { key: 'all' as const, label: 'All', count: counts.total },
              { key: 'pending' as const, label: 'Pending', count: counts.pending },
              { key: 'active' as const, label: 'Active', count: counts.active },
              { key: 'frozen' as const, label: 'Frozen', count: undefined },
              { key: 'inactive' as const, label: 'Inactive', count: counts.inactive },
            ] as { key: GymMembershipStatus | 'all'; label: string; count?: number }[]
          ).map(tab => {
            const isSelected = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setSelectedStatus(tab.key);
                  setPage(1);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.85rem',
                  fontWeight: isSelected ? 700 : 500,
                  border: isSelected
                    ? '1px solid var(--accent-gold)'
                    : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(214, 168, 79, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    style={{
                      background: isSelected ? 'var(--accent-gold)' : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#000' : 'var(--text-muted)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1', maxWidth: '360px' }}>
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
            placeholder="Search athlete or plan..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </div>
      </div>

      {/* MEMBER ROSTER TABLE */}
      <div
        className="card card-elevated"
        style={{
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-glass-card)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        {loading && members.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw
              size={24}
              style={{ animation: 'spin 1s linear infinite', margin: '0 auto var(--space-2)' }}
            />
            <div>Loading member records...</div>
          </div>
        ) : members.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-10) var(--space-6)',
              textAlign: 'center',
            }}
          >
            <Search
              size={40}
              style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }}
            />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
              No Members Found
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
              {searchQuery
                ? `No member records match "${searchQuery}". Try adjusting your search query or status filter.`
                : selectedStatus === 'pending'
                ? 'No pending approval requests. All applicant passes are up to date.'
                : 'No athletes found for this filter.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Athlete</th>
                  <th style={{ padding: '12px 16px' }}>Membership Type</th>
                  <th style={{ padding: '12px 16px' }}>Enrolled / Joined</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => {
                  const athleteName = member.userProfile?.displayName || 'Athlete';
                  const avatarUrl = member.userProfile?.avatarUrl;
                  const isActionLoading = actionLoadingId === member.id;

                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Athlete Identity */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={athleteName}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-full)',
                                objectFit: 'cover',
                                border: '1px solid var(--border-subtle)',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: 'var(--radius-full)',
                                background: 'linear-gradient(135deg, rgba(214, 168, 79, 0.2) 0%, rgba(214, 168, 79, 0.05) 100%)',
                                color: 'var(--accent-gold)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                border: '1px solid rgba(214, 168, 79, 0.3)',
                              }}
                            >
                              {athleteName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {athleteName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ID: {member.userId.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Membership Type */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {member.membershipType.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Facility Access
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          {member.joinedAt ? formatVisitDateIST(member.joinedAt) : 'Pending activation'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {renderStatusBadge(member.status)}
                      </td>

                      {/* Lifecycle Action Buttons */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {isActionLoading ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: 'var(--accent-gold)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            <span>Updating...</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              justifyContent: 'flex-end',
                            }}
                          >
                            {/* PENDING -> APPROVE */}
                            {member.status === 'pending' && (
                              <button
                                onClick={() => openConfirmation(member, 'active')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 12px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Approve</span>
                              </button>
                            )}

                            {/* ACTIVE -> FREEZE */}
                            {member.status === 'active' && (
                              <button
                                onClick={() => openConfirmation(member, 'frozen')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  color: '#60A5FA',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Temporarily freeze access"
                              >
                                <PauseCircle size={13} />
                                <span>Freeze</span>
                              </button>
                            )}

                            {/* FROZEN -> UNFREEZE */}
                            {member.status === 'frozen' && (
                              <button
                                onClick={() => openConfirmation(member, 'active')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10B981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Unfreeze and restore pass"
                              >
                                <PlayCircle size={13} />
                                <span>Unfreeze</span>
                              </button>
                            )}

                            {/* ACTIVE OR FROZEN -> DEACTIVATE */}
                            {(member.status === 'active' || member.status === 'frozen') && (
                              <button
                                onClick={() => openConfirmation(member, 'inactive')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Deactivate member pass"
                              >
                                <UserX size={13} />
                                <span>Deactivate</span>
                              </button>
                            )}

                            {/* INACTIVE (Terminal) */}
                            {member.status === 'inactive' && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  fontStyle: 'italic',
                                }}
                              >
                                Inactive pass
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {totalCount > pageSize && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, totalCount)} of {totalCount} members
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="btn btn-outline btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {page} / {totalPages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="btn btn-outline btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
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
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="card card-elevated animate-fade-in"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: 'var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(214, 168, 79, 0.15)',
                  color: 'var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                {confirmModal.title}
              </h3>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
              {confirmModal.description}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="btn btn-outline btn-sm"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleExecuteStatusChange(confirmModal.membership, confirmModal.targetStatus)
                }
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: confirmModal.buttonColor,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {confirmModal.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
