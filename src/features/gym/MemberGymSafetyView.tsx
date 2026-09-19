import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  PhoneCall,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  EyeOff,
  Info,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymSafetyService } from '@/services/gym-safety.service';
import {
  GymSafetyCategory,
  GymSafetySeverity,
  GymSafetyIncident,
  GymEmergencyContact,
  GymSafetyNotice,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

const CATEGORIES: { value: GymSafetyCategory; label: string; desc: string }[] = [
  { value: 'equipment_hazard', label: 'Equipment Hazard', desc: 'Broken cable, loose bolts, failing bench' },
  { value: 'facility_damage', label: 'Facility Damage', desc: 'Water leak, broken mirror, exposed wiring' },
  { value: 'hygiene_sanitation', label: 'Hygiene & Sanitation', desc: 'Biohazard, unsanitary equipment, shower issue' },
  { value: 'member_harassment', label: 'Member Harassment / Conduct', desc: 'Intimidation, unwanted contact, aggressive behavior' },
  { value: 'theft_security', label: 'Theft & Security', desc: 'Locker break-in, missing property, unauthorized entry' },
  { value: 'medical_emergency', label: 'Medical Emergency', desc: 'Fainting, acute injury, cardiac event' },
  { value: 'staff_conduct', label: 'Staff Conduct', desc: 'Unprofessional behavior, protocol violation' },
  { value: 'other', label: 'Other Hazard / Feedback', desc: 'Any other safety concern' },
];

const SEVERITIES: { value: GymSafetySeverity; label: string; color: string; badgeClass: string }[] = [
  { value: 'low', label: 'Low', color: '#10b981', badgeClass: 'badge-success' },
  { value: 'medium', label: 'Medium', color: '#f59e0b', badgeClass: 'badge-warning' },
  { value: 'high', label: 'High', color: '#f97316', badgeClass: 'badge-accent' },
  { value: 'critical', label: 'Critical / Urgent', color: '#ef4444', badgeClass: 'badge-danger' },
];

export const MemberGymSafetyView: React.FC = () => {
  const memberGymCtx = useMemberGymContext();
  const activeGym = memberGymCtx?.activeGym;

  const [activeTab, setActiveTab] = useState<'report' | 'my_reports' | 'emergency_contact' | 'sos'>('report');
  const [notices, setNotices] = useState<GymSafetyNotice[]>([]);
  const [myIncidents, setMyIncidents] = useState<GymSafetyIncident[]>([]);
  const [, setEmergencyContact] = useState<GymEmergencyContact | null>(null);
  const [, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State: Incident Report
  const [category, setCategory] = useState<GymSafetyCategory>('equipment_hazard');
  const [severity, setSeverity] = useState<GymSafetySeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationInFacility, setLocationInFacility] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reportedUserId, setReportedUserId] = useState('');
  const [triggerBlock, setTriggerBlock] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Emergency Contact Form State
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [altPhoneNumber, setAltPhoneNumber] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // SOS Confirmation State
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosLocationDetails, setSosLocationDetails] = useState('');
  const [sosTriggering, setSosTriggering] = useState(false);
  const [sosResult, setSosResult] = useState<{ active: boolean; message: string; gymName?: string } | null>(null);

  // Load Initial Data
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        if (activeGym?.id) {
          const [noticesRes, contactRes, incidentsRes] = await Promise.all([
            gymSafetyService.getActiveSafetyNotices(activeGym.id),
            gymSafetyService.getMyEmergencyContact(),
            gymSafetyService.getMyReportedIncidents(),
          ]);

          if (isMounted) {
            setNotices(noticesRes);
            setEmergencyContact(contactRes);
            setMyIncidents(incidentsRes);
            if (contactRes) {
              setContactName(contactRes.contactName);
              setRelationship(contactRes.relationship);
              setPhoneNumber(contactRes.phoneNumber);
              setAltPhoneNumber(contactRes.alternativePhone || '');
              setMedicalNotes(contactRes.medicalNotes || '');
            }
          }
        }
      } catch (err) {
        logger.error('MemberGymSafetyView: loadData error', { err });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeGym?.id]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!activeGym?.id) {
      setActionError('You must be a member of an active facility to report an incident.');
      return;
    }

    setSubmittingReport(true);
    try {
      const res = await gymSafetyService.reportIncident({
        gymId: activeGym.id,
        category,
        severity,
        title,
        description,
        locationInFacility: locationInFacility || undefined,
        reportedUserId: reportedUserId || undefined,
        isAnonymous,
        triggerBlock: category === 'member_harassment' && !!reportedUserId && triggerBlock,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to submit incident report.');
      } else {
        setActionSuccess('Incident report securely submitted to facility management.');
        setTitle('');
        setDescription('');
        setLocationInFacility('');
        setReportedUserId('');
        setTriggerBlock(false);
        // Refresh My Reports list
        const updated = await gymSafetyService.getMyReportedIncidents();
        setMyIncidents(updated);
        setActiveTab('my_reports');
      }
    } catch (err: any) {
      setActionError(err.message || 'An unexpected error occurred while submitting.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setSavingContact(true);

    try {
      const res = await gymSafetyService.saveEmergencyContact({
        contactName,
        relationship,
        phoneNumber,
        alternativePhone: altPhoneNumber || null,
        medicalNotes: medicalNotes || null,
      });

      if (!res.success) {
        setActionError(res.error || 'Failed to save emergency contact.');
      } else {
        setActionSuccess('Emergency contact saved successfully.');
        setEmergencyContact(res.contact || null);
      }
    } catch (err: any) {
      setActionError(err.message || 'An unexpected error occurred.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleConfirmSos = async () => {
    setActionError(null);
    setSosTriggering(true);

    try {
      const res = await gymSafetyService.triggerEmergencySos(sosLocationDetails);
      if (!res.success) {
        setActionError(res.error || 'Unable to trigger Emergency SOS.');
      } else {
        setSosResult({
          active: true,
          message: res.isDeduplicated
            ? 'Emergency SOS updated! Staff are already actively responding to this alert.'
            : 'EMERGENCY SOS BROADCAST ACTIVE! Facility staff and first responders have been notified.',
          gymName: res.gymName,
        });
        setSosModalOpen(false);
        setSosLocationDetails('');
        // Refresh incidents
        const updated = await gymSafetyService.getMyReportedIncidents();
        setMyIncidents(updated);
      }
    } catch (err: any) {
      setActionError(err.message || 'Emergency SOS trigger failed.');
    } finally {
      setSosTriggering(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header Banner */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-6)',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(30, 41, 59, 0.6) 100%)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Gym Safety & SPS</h1>
            <span className="badge badge-accent" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
              PROTECTION SYSTEM
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '560px' }}>
            Physical hazard reporting, anonymous member safety, next-of-kin emergency contact, and instant floor SOS.
          </p>
        </div>

        {/* SOS Quick Trigger Button */}
        <button
          type="button"
          className="btn"
          onClick={() => setSosModalOpen(true)}
          style={{
            background: '#ef4444',
            color: '#ffffff',
            fontWeight: 800,
            padding: '12px 24px',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
          }}
        >
          <AlertTriangle size={18} />
          <span>TRIGGER SOS</span>
        </button>
      </div>

      {/* Active Notices Banner */}
      {notices.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {notices.map(notice => (
            <div
              key={notice.id}
              style={{
                padding: 'var(--space-4) var(--space-5)',
                background: notice.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `4px solid ${notice.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <BellRing size={18} color={notice.severity === 'critical' ? '#ef4444' : '#f59e0b'} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{notice.title}</span>
                  <span className="badge" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    {notice.noticeType.replace('_', ' ')}
                  </span>
                  {notice.affectedArea && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      📍 {notice.affectedArea}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  {notice.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Notifications */}
      {actionSuccess && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#10b981',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* SOS Active Notification */}
      {sosResult?.active && (
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid #ef4444',
            borderRadius: 'var(--radius-lg)',
            color: '#f87171',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
              {sosResult.message}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#fca5a5' }}>
              Gym staff have been alerted to your session. If this is a life-threatening medical emergency, call 911/112 immediately.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-6)',
          paddingBottom: 'var(--space-2)',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'report' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('report')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileText size={15} />
          <span>Report Hazard / Incident</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'my_reports' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('my_reports')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Clock size={15} />
          <span>My Reports ({myIncidents.length})</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'emergency_contact' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('emergency_contact')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <PhoneCall size={15} />
          <span>Emergency Contact</span>
        </button>

        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'sos' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('sos')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
        >
          <AlertTriangle size={15} />
          <span>SOS Protocol</span>
        </button>
      </div>

      {/* ====================================================================
          TAB 1: REPORT HAZARD / INCIDENT
          ==================================================================== */}
      {activeTab === 'report' && (
        <div className="card card-elevated" style={{ padding: 'var(--space-6)', background: 'var(--bg-surface)' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: 0, marginBottom: 'var(--space-4)' }}>
            Submit Facility Safety Report
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            Report faulty equipment, facility hazards, or member misconduct directly to gym management. You can optionally submit anonymously.
          </p>

          <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Category Grid */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px' }}>
                Incident Category *
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '8px',
                }}
              >
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      background: category === cat.value ? 'rgba(79, 140, 255, 0.15)' : 'var(--bg-surface-elevated)',
                      border: category === cat.value ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: category === cat.value ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cat.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Radio Bar */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '8px' }}>
                Severity Assessment *
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {SEVERITIES.map(sev => (
                  <button
                    key={sev.value}
                    type="button"
                    onClick={() => setSeverity(sev.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: severity === sev.value ? `${sev.color}22` : 'var(--bg-surface-elevated)',
                      border: severity === sev.value ? `2px solid ${sev.color}` : '1px solid var(--border-subtle)',
                      color: severity === sev.value ? sev.color : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="report-title" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                Summary / Title * (3–120 characters)
              </label>
              <input
                id="report-title"
                type="text"
                className="input"
                placeholder="e.g., Cable fraying on high-pulley station 2"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                required
                style={{ width: '100%' }}
              />
            </div>

            {/* Location in Facility */}
            <div>
              <label htmlFor="report-loc" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                Floor Location (Optional)
              </label>
              <input
                id="report-loc"
                type="text"
                className="input"
                placeholder="e.g., Cable crossover section, 2nd floor functional turf"
                value={locationInFacility}
                onChange={e => setLocationInFacility(e.target.value)}
                maxLength={120}
                style={{ width: '100%' }}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="report-desc" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                Detailed Description * (10–2000 characters)
              </label>
              <textarea
                id="report-desc"
                className="input"
                rows={4}
                placeholder="Describe what you observed, equipment IDs involved, or details to help staff investigate..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={2000}
                required
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            {/* Optional Reported User ID (Only for harassment / interpersonal) */}
            {category === 'member_harassment' && (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                <label htmlFor="reported-user" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                  Member UUID (Optional)
                </label>
                <input
                  id="reported-user"
                  type="text"
                  className="input"
                  placeholder="Paste member UUID or leave blank if unknown"
                  value={reportedUserId}
                  onChange={e => setReportedUserId(e.target.value)}
                  style={{ width: '100%', marginBottom: '10px' }}
                />

                {reportedUserId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', color: '#ef4444' }}>
                    <input
                      type="checkbox"
                      checked={triggerBlock}
                      onChange={e => setTriggerBlock(e.target.checked)}
                    />
                    <span style={{ fontWeight: 700 }}>Also Block this member from Buddy Matching (G3)</span>
                  </label>
                )}
              </div>
            )}

            {/* Anonymous Toggle */}
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <EyeOff size={20} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Submit Anonymously</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Your name and profile will be masked. Facility owners and staff will only see "Anonymous Member".
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
              />
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'var(--space-2)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingReport || title.trim().length < 3 || description.trim().length < 10}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px', justifyContent: 'center' }}
              >
                {submittingReport ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
          TAB 2: MY REPORTS & STATUS TRACKING
          ==================================================================== */}
      {activeTab === 'my_reports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>My Submitted Reports</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const list = await gymSafetyService.getMyReportedIncidents();
                setMyIncidents(list);
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {myIncidents.length === 0 ? (
            <div
              className="card"
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
              }}
            >
              <CheckCircle2 size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>No Reports Filed</div>
              <p style={{ fontSize: '0.84rem', margin: '4px 0 0 0' }}>
                You have not filed any safety or hazard reports yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {myIncidents.map(inc => {
                let statusBadgeBg = 'rgba(79, 140, 255, 0.15)';
                let statusColor = 'var(--accent-primary)';
                if (inc.status === 'resolved') {
                  statusBadgeBg = 'rgba(16, 185, 129, 0.15)';
                  statusColor = '#10b981';
                } else if (inc.status === 'dismissed') {
                  statusBadgeBg = 'rgba(100, 116, 139, 0.15)';
                  statusColor = 'var(--text-muted)';
                } else if (inc.status === 'investigating' || inc.status === 'action_taken') {
                  statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
                  statusColor = '#f59e0b';
                }

                return (
                  <div
                    key={inc.id}
                    className="card card-elevated"
                    style={{
                      padding: 'var(--space-5)',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span
                            className="badge"
                            style={{
                              background: statusBadgeBg,
                              color: statusColor,
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                            }}
                          >
                            {inc.status.replace('_', ' ')}
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            {inc.category.replace('_', ' ')}
                          </span>
                          {inc.isAnonymous && (
                            <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>
                              Anonymous
                            </span>
                          )}
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            Filed {new Date(inc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '4px 0' }}>{inc.title}</h3>
                        {inc.locationInFacility && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            📍 {inc.locationInFacility}
                          </div>
                        )}
                        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                          {inc.description}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <div>Facility: {inc.gymName || 'Local Gym'}</div>
                      </div>
                    </div>

                    {/* Resolution Notes */}
                    {inc.resolutionNotes && (
                      <div
                        style={{
                          marginTop: 'var(--space-3)',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--bg-surface-elevated)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '3px solid #10b981',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#10b981', marginBottom: '2px' }}>
                          STAFF RESOLUTION NOTES
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                          {inc.resolutionNotes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 3: EMERGENCY CONTACT
          ==================================================================== */}
      {activeTab === 'emergency_contact' && (
        <div className="card card-elevated" style={{ padding: 'var(--space-6)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-2)' }}>
            <PhoneCall size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Next-of-Kin Emergency Contact</h2>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Designate a trusted contact for gym staff or emergency responders in the event of an acute medical incident.
          </p>

          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(79, 140, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(79, 140, 255, 0.2)',
              marginBottom: 'var(--space-6)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Strict Privacy Safeguard:</strong> Gym owners and staff can <em>only</em> view this information if you are physically checked in to the gym floor during an active session. Access is automatically revoked upon checkout and logged immutably.
            </div>
          </div>

          <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label htmlFor="contact-name" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                  Contact Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  className="input"
                  placeholder="e.g., Sarah Johnson"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  maxLength={100}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="contact-rel" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                  Relationship *
                </label>
                <input
                  id="contact-rel"
                  type="text"
                  className="input"
                  placeholder="e.g., Spouse, Parent, Partner, Sibling"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                  maxLength={50}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label htmlFor="contact-phone" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                  Primary Phone Number *
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="input"
                  placeholder="e.g., +1 555-019-2831"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  maxLength={20}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="contact-alt-phone" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                  Alternative Phone (Optional)
                </label>
                <input
                  id="contact-alt-phone"
                  type="tel"
                  className="input"
                  placeholder="e.g., +1 555-019-2832"
                  value={altPhoneNumber}
                  onChange={e => setAltPhoneNumber(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-med" style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', marginBottom: '6px' }}>
                Critical Medical Notes / Allergies (Optional, max 500 chars)
              </label>
              <textarea
                id="contact-med"
                className="input"
                rows={3}
                placeholder="e.g., Type 1 diabetic (carries glucose), severe penicillin allergy, asthmatic"
                value={medicalNotes}
                onChange={e => setMedicalNotes(e.target.value)}
                maxLength={500}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingContact || !contactName.trim() || !phoneNumber.trim()}
                style={{ minWidth: '160px' }}
              >
                {savingContact ? 'Saving...' : 'Save Emergency Contact'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
          TAB 4: SOS PROTOCOL & INSTRUCTIONS
          ==================================================================== */}
      {activeTab === 'sos' && (
        <div className="card card-elevated" style={{ padding: 'var(--space-6)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
            <AlertTriangle size={24} color="#ef4444" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ef4444' }}>
              Gym Emergency SOS Protocol
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <p>
              The Gym Safety & Protection System allows you to broadcast an immediate high-priority emergency alert to on-duty gym staff and coaches while you are checked into the facility.
            </p>

            <div
              style={{
                padding: 'var(--space-4)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <strong style={{ color: '#ef4444' }}>Notice on Emergency Dispatch:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                GymBuddy SOS notifies facility floor staff and managers on duty. It does NOT automatically summon external 911/112 municipal emergency responders. If you or someone around you is in immediate life-threatening peril, please call municipal emergency services immediately.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-2)' }}>
              <strong>When to trigger Emergency SOS:</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                <li>Acute physical injury (dislocation, severe muscle tear, heavy weight drop)</li>
                <li>Dizziness, chest pain, or loss of consciousness</li>
                <li>Physical altercation or active security hazard on the floor</li>
                <li>Trapped under a barbell or machine without a spotter</li>
              </ul>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setSosModalOpen(true)}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '12px 28px',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                OPEN SOS TRIGGER MODAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          EMERGENCY SOS CONFIRMATION MODAL
          ==================================================================== */}
      {sosModalOpen && (
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
              maxWidth: '480px',
              width: '100%',
              padding: 'var(--space-6)',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '2px solid #ef4444',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>
                  Trigger Emergency SOS
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Immediate Floor Broadcast
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              This will broadcast a critical medical/safety alert to on-duty gym staff with your floor check-in details.
            </p>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label htmlFor="sos-loc" style={{ display: 'block', fontWeight: 700, fontSize: '0.84rem', marginBottom: '6px' }}>
                Exact Location / Equipment (Optional)
              </label>
              <input
                id="sos-loc"
                type="text"
                className="input"
                placeholder="e.g., Squat Rack 4, Bench Press #2, Turf area"
                value={sosLocationDetails}
                onChange={e => setSosLocationDetails(e.target.value)}
                maxLength={200}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSosModalOpen(false)}
                disabled={sosTriggering}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirmSos}
                disabled={sosTriggering}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {sosTriggering ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} />
                    <span>CONFIRM EMERGENCY SOS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
