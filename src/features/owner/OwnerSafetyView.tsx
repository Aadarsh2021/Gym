import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  User,
  PhoneCall,
  Megaphone,
  History,
  Filter,
  RefreshCw,
  X,
} from 'lucide-react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { gymSafetyService } from '@/services/gym-safety.service';
import {
  GymSafetyIncident,
  GymSafetyIncidentStatus,
  GymSafetySeverity,
  GymSafetyIncidentLog,
  GymEmergencyContact,
  GymSafetyNotice,
  GymSafetyNoticeType,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Incidents' },
  { value: 'reported', label: 'Reported' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'action_taken', label: 'Action Taken' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const SEVERITY_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const OwnerSafetyView: React.FC = () => {
  const { activeGym, loading: loadingGyms } = useOwnerGym();

  const [incidents, setIncidents] = useState<GymSafetyIncident[]>([]);
  const [notices, setNotices] = useState<GymSafetyNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Selected Incident Modal State
  const [selectedIncident, setSelectedIncident] = useState<GymSafetyIncident | null>(null);
  const [auditLogs, setAuditLogs] = useState<GymSafetyIncidentLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [targetContact, setTargetContact] = useState<GymEmergencyContact | null>(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Status update in modal
  const [newStatus, setNewStatus] = useState<GymSafetyIncidentStatus | ''>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  // Notice Creation Modal State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeType, setNoticeType] = useState<GymSafetyNoticeType>('hazard_warning');
  const [noticeSeverity, setNoticeSeverity] = useState<GymSafetySeverity>('high');
  const [noticeArea, setNoticeArea] = useState('');
  const [publishingNotice, setPublishingNotice] = useState(false);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    if (!activeGym?.id) return;
    setLoading(true);
    try {
      const filters = {
        status: statusFilter !== 'all' ? (statusFilter as GymSafetyIncidentStatus) : undefined,
        severity: severityFilter !== 'all' ? (severityFilter as GymSafetySeverity) : undefined,
      };
      const [incidentList, noticeList] = await Promise.all([
        gymSafetyService.getFacilityIncidents(activeGym.id, filters),
        gymSafetyService.getActiveSafetyNotices(activeGym.id),
      ]);
      setIncidents(incidentList);
      setNotices(noticeList);
    } catch (err) {
      logger.error('OwnerSafetyView: loadIncidents error', { err });
    } finally {
      setLoading(false);
    }
  }, [activeGym?.id, statusFilter, severityFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleOpenIncident = async (incident: GymSafetyIncident) => {
    setSelectedIncident(incident);
    setNewStatus('');
    setResolutionNotes('');
    setUpdateError(null);
    setUpdateSuccess(null);
    setTargetContact(null);
    setContactError(null);

    // Load audit trail
    setLoadingAudit(true);
    try {
      const logs = await gymSafetyService.getIncidentAuditTrail(incident.id);
      setAuditLogs(logs);
    } catch (err) {
      logger.error('OwnerSafetyView: load audit error', { err });
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleLookupEmergencyContact = async (userId: string) => {
    if (!activeGym?.id) return;
    setContactChecking(true);
    setContactError(null);
    try {
      const contact = await gymSafetyService.getActiveMemberEmergencyContact(userId, activeGym.id);
      if (contact) {
        setTargetContact(contact);
      } else {
        setContactError('Emergency contact unavailable or member is not currently checked in.');
      }
    } catch (err: any) {
      setContactError(err.message || 'Access denied. Member must have an active floor session.');
    } finally {
      setContactChecking(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident || !newStatus) return;
    setUpdatingStatus(true);
    setUpdateError(null);
    setUpdateSuccess(null);

    try {
      const res = await gymSafetyService.updateIncidentStatus(
        selectedIncident.id,
        newStatus as GymSafetyIncidentStatus,
        resolutionNotes,
        selectedIncident.status
      );

      if (!res.success) {
        setUpdateError(res.error || 'Failed to update status.');
      } else {
        setUpdateSuccess(`Status updated to ${newStatus}.`);
        // Refresh local incident state
        setSelectedIncident(prev => (prev ? { ...prev, status: newStatus as GymSafetyIncidentStatus, resolutionNotes: resolutionNotes || prev.resolutionNotes } : null));
        // Refresh audit trail
        const logs = await gymSafetyService.getIncidentAuditTrail(selectedIncident.id);
        setAuditLogs(logs);
        // Refresh main list
        loadIncidents();
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Status transition failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym?.id) return;
    setPublishingNotice(true);
    setNoticeError(null);

    try {
      const res = await gymSafetyService.publishSafetyNotice(activeGym.id, {
        title: noticeTitle,
        content: noticeContent,
        noticeType,
        severity: noticeSeverity,
        affectedArea: noticeArea || undefined,
        startsAt: new Date().toISOString(),
      });

      if (!res.success) {
        setNoticeError(res.error || 'Failed to publish notice.');
      } else {
        setShowNoticeModal(false);
        setNoticeTitle('');
        setNoticeContent('');
        setNoticeArea('');
        loadIncidents();
      }
    } catch (err: any) {
      setNoticeError(err.message || 'Publication failed.');
    } finally {
      setPublishingNotice(false);
    }
  };

  if (loadingGyms) {
    return (
      <div className="container" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (!activeGym) {
    return (
      <div className="container" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <h2>No Active Facility Selected</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Please select a gym facility to manage safety incidents and floor notices.
        </p>
      </div>
    );
  }

  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'dismissed').length;

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header Bar */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-6)',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Safety & SPS Console</h1>
            <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
              {activeGym.name}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Physical incident triage, anonymous reporter masking, verified audit ledger, and floor safety notices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {criticalCount > 0 && (
            <div
              style={{
                padding: '8px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{criticalCount} CRITICAL ALERT{criticalCount > 1 ? 'S' : ''}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNoticeModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Megaphone size={15} />
            <span>Publish Floor Notice</span>
          </button>
        </div>
      </div>

      {/* Active Floor Notices Banner */}
      {notices.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Active Floor Notices ({notices.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
            {notices.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${n.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{n.title}</span>
                  <span className="badge" style={{ fontSize: '0.66rem', textTransform: 'uppercase' }}>
                    {n.severity}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {n.content}
                </p>
                {n.affectedArea && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    📍 {n.affectedArea}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Filters */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Status:</span>
            <select
              className="input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', height: '34px' }}
            >
              {STATUS_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Severity:</span>
            <select
              className="input"
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', height: '34px' }}
            >
              {SEVERITY_FILTERS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadIncidents}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Incidents Queue */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>Loading safety incidents...</div>
        </div>
      ) : incidents.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
          }}
        >
          <CheckCircle2 size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>No Safety Incidents Match Filters</div>
          <p style={{ fontSize: '0.84rem', margin: '4px 0 0 0' }}>
            The facility safety queue is clear.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {incidents.map(inc => {
            let sevColor = '#10b981';
            if (inc.severity === 'critical') sevColor = '#ef4444';
            else if (inc.severity === 'high') sevColor = '#f97316';
            else if (inc.severity === 'medium') sevColor = '#f59e0b';

            return (
              <div
                key={inc.id}
                className="card card-elevated"
                onClick={() => handleOpenIncident(inc)}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `4px solid ${sevColor}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          background: `${sevColor}22`,
                          color: sevColor,
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        {inc.severity}
                      </span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>
                        {inc.category.replace('_', ' ')}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        {inc.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '2px 0 4px 0' }}>{inc.title}</h3>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {inc.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {/* Reporter Display — strictly masked if anonymous */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {inc.isAnonymous ? (
                          <>
                            <EyeOff size={13} color="var(--text-muted)" />
                            <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Anonymous Member (Active Verified)</span>
                          </>
                        ) : (
                          <>
                            <User size={13} />
                            <span>Reporter: {inc.reporterName || 'Member'}</span>
                          </>
                        )}
                      </div>

                      {inc.locationInFacility && (
                        <div>📍 {inc.locationInFacility}</div>
                      )}

                      <div>🕒 {new Date(inc.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.76rem', padding: '6px 12px' }}
                    >
                      Triage Details &rarr;
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ====================================================================
          INCIDENT DETAIL & TRIAGE MODAL
          ==================================================================== */}
      {selectedIncident && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 9999,
          }}
        >
          <div
            className="card card-elevated"
            style={{
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'var(--space-6)',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="badge badge-accent" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    {selectedIncident.category.replace('_', ' ')}
                  </span>
                  <span className="badge" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    {selectedIncident.severity}
                  </span>
                  <span className="badge badge-secondary" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    {selectedIncident.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{selectedIncident.title}</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedIncident(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Incident Details Card */}
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                INCIDENT DESCRIPTION
              </div>
              <p style={{ margin: '0 0 var(--space-3) 0' }}>{selectedIncident.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <div>
                  <strong>Reporter:</strong>{' '}
                  {selectedIncident.isAnonymous ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Anonymous Member (Masked)</span>
                  ) : (
                    <span>{selectedIncident.reporterName || 'Member'}</span>
                  )}
                </div>
                <div>
                  <strong>Floor Location:</strong> {selectedIncident.locationInFacility || 'General floor'}
                </div>
                <div>
                  <strong>Reported At:</strong> {new Date(selectedIncident.createdAt).toLocaleString()}
                </div>
                {selectedIncident.reportedUserId && (
                  <div>
                    <strong>Reported Party:</strong> {selectedIncident.reportedUserName || selectedIncident.reportedUserId}
                  </div>
                )}
              </div>
            </div>

            {/* Next-of-Kin Emergency Lookup (Active Check-In Only) */}
            {selectedIncident.reportedUserId && (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(79, 140, 255, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(79, 140, 255, 0.2)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.84rem' }}>
                    <PhoneCall size={15} color="var(--accent-primary)" />
                    <span>Emergency Contact Lookup</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleLookupEmergencyContact(selectedIncident.reportedUserId!)}
                    disabled={contactChecking}
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    {contactChecking ? 'Verifying...' : 'Request Emergency Contact'}
                  </button>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Restricted to checked-in floor members during active incidents. Access is strictly audited.
                </div>

                {contactError && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ef4444' }}>
                    {contactError}
                  </div>
                )}

                {targetContact && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div><strong>Contact Name:</strong> {targetContact.contactName} ({targetContact.relationship})</div>
                    <div><strong>Phone:</strong> {targetContact.phoneNumber}</div>
                    {targetContact.alternativePhone && <div><strong>Alt Phone:</strong> {targetContact.alternativePhone}</div>}
                    {targetContact.medicalNotes && (
                      <div style={{ marginTop: '4px', color: '#ef4444' }}>
                        <strong>Medical Notes:</strong> {targetContact.medicalNotes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Status Transition Controls */}
            {selectedIncident.status !== 'resolved' && selectedIncident.status !== 'dismissed' ? (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px' }}>
                  Advance Investigation / Status
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {selectedIncident.status === 'reported' && (
                    <button
                      type="button"
                      className={`btn btn-sm ${newStatus === 'acknowledged' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setNewStatus('acknowledged')}
                    >
                      Acknowledge
                    </button>
                  )}
                  {(selectedIncident.status === 'reported' || selectedIncident.status === 'acknowledged') && (
                    <button
                      type="button"
                      className={`btn btn-sm ${newStatus === 'investigating' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setNewStatus('investigating')}
                    >
                      Investigating
                    </button>
                  )}
                  {(selectedIncident.status === 'acknowledged' || selectedIncident.status === 'investigating') && (
                    <button
                      type="button"
                      className={`btn btn-sm ${newStatus === 'action_taken' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setNewStatus('action_taken')}
                    >
                      Action Taken
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-sm ${newStatus === 'resolved' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setNewStatus('resolved')}
                    style={{ color: '#10b981' }}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${newStatus === 'dismissed' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setNewStatus('dismissed')}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Dismiss
                  </button>
                </div>

                {newStatus && (
                  <div>
                    <label htmlFor="resolution-notes" style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                      Resolution Notes / Staff Actions
                    </label>
                    <textarea
                      id="resolution-notes"
                      className="input"
                      rows={3}
                      placeholder="Detail actions taken, equipment repaired, or outcome for the member..."
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      maxLength={1000}
                      style={{ width: '100%', marginBottom: '10px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleUpdateStatus}
                        disabled={updatingStatus}
                      >
                        {updatingStatus ? 'Updating...' : `Confirm Status: ${newStatus}`}
                      </button>
                    </div>
                  </div>
                )}

                {updateError && (
                  <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '0.82rem' }}>
                    {updateError}
                  </div>
                )}
                {updateSuccess && (
                  <div style={{ marginTop: '8px', color: '#10b981', fontSize: '0.82rem' }}>
                    {updateSuccess}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                  fontSize: '0.84rem',
                  color: 'var(--text-muted)',
                }}
              >
                🔒 This incident has been marked as <strong>{selectedIncident.status}</strong> and is legally archived.
                {selectedIncident.resolutionNotes && (
                  <div style={{ marginTop: '6px', color: 'var(--text-primary)' }}>
                    <strong>Resolution Summary:</strong> {selectedIncident.resolutionNotes}
                  </div>
                )}
              </div>
            )}

            {/* Immutable Audit Ledger Drawer */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.86rem', marginBottom: '8px' }}>
                <History size={16} />
                <span>Verified Audit Trail (Immutable)</span>
              </div>

              {loadingAudit ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading audit records...</div>
              ) : auditLogs.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No audit events logged.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {auditLogs.map(log => (
                    <div
                      key={log.id}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <strong>{log.action.replace('_', ' ').toUpperCase()}</strong>
                        {log.previousStatus && log.newStatus && (
                          <span> ({log.previousStatus} &rarr; {log.newStatus})</span>
                        )}
                        {log.notes && <div style={{ color: 'var(--text-muted)' }}>{log.notes}</div>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          PUBLISH FLOOR NOTICE MODAL
          ==================================================================== */}
      {showNoticeModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            zIndex: 9999,
          }}
        >
          <div
            className="card card-elevated"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: 'var(--space-6)',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Publish Floor Safety Notice</h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNoticeModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublishNotice} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label htmlFor="notice-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '4px' }}>
                  Notice Title * (3–120 characters)
                </label>
                <input
                  id="notice-title"
                  type="text"
                  className="input"
                  placeholder="e.g., Cable crossover machine down for maintenance"
                  value={noticeTitle}
                  onChange={e => setNoticeTitle(e.target.value)}
                  maxLength={120}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="notice-type" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '4px' }}>
                    Notice Type
                  </label>
                  <select
                    id="notice-type"
                    className="input"
                    value={noticeType}
                    onChange={e => setNoticeType(e.target.value as GymSafetyNoticeType)}
                    style={{ width: '100%' }}
                  >
                    <option value="hazard_warning">Hazard Warning</option>
                    <option value="maintenance_closure">Maintenance Closure</option>
                    <option value="safety_guideline">Safety Guideline</option>
                    <option value="emergency_advisory">Emergency Advisory</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="notice-sev" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '4px' }}>
                    Severity
                  </label>
                  <select
                    id="notice-sev"
                    className="input"
                    value={noticeSeverity}
                    onChange={e => setNoticeSeverity(e.target.value as GymSafetySeverity)}
                    style={{ width: '100%' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="notice-area" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '4px' }}>
                  Affected Area (Optional)
                </label>
                <input
                  id="notice-area"
                  type="text"
                  className="input"
                  placeholder="e.g., Free weights section, Men's sauna, Cardio row 3"
                  value={noticeArea}
                  onChange={e => setNoticeArea(e.target.value)}
                  maxLength={120}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="notice-content" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '4px' }}>
                  Notice Content * (10–2000 characters)
                </label>
                <textarea
                  id="notice-content"
                  className="input"
                  rows={4}
                  placeholder="Explain the safety notice, estimated repair time, or alternative equipment..."
                  value={noticeContent}
                  onChange={e => setNoticeContent(e.target.value)}
                  maxLength={2000}
                  required
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {noticeError && (
                <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>
                  {noticeError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowNoticeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={publishingNotice || noticeTitle.trim().length < 3 || noticeContent.trim().length < 10}
                >
                  {publishingNotice ? 'Publishing...' : 'Broadcast Floor Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
