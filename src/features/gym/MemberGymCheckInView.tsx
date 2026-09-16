import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Building2,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  MapPin,
  XCircle,
  ShieldCheck,
  LogOut,
  Clock,
  Dumbbell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymCheckinService } from '@/services/gym-checkin.service';
import { gymCheckoutService } from '@/services/gym-checkout.service';
import { platform } from '@/platform';
import { Gym, GymAttendanceSession } from '@/types/gym.types';
import { Link } from 'react-router-dom';

export const MemberGymCheckInView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || '';
  const userRole = session.profile?.accountRole || 'member';

  const memberGymCtx = useMemberGymContext();
  const { mode, activeGym, activeMembership, isLoading: ctxLoading } = memberGymCtx;

  // Active Session State
  const [activeSession, setActiveSession] = useState<GymAttendanceSession | null>(null);
  const [activeSessionGym, setActiveSessionGym] = useState<Gym | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);

  // Live Elapsed Time State (display-only, never persisted per tick)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Scanner UI States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Checkout UI States
  const [checkingOut, setCheckingOut] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Visit State (immediate UI presentation post-checkout)
  const [completedSession, setCompletedSession] = useState<GymAttendanceSession | null>(null);
  const [completedGym, setCompletedGym] = useState<Gym | null>(null);

  // Successful Check-In State
  const [successResult, setSuccessResult] = useState<{
    session: GymAttendanceSession;
    gym: Gym;
  } | null>(null);

  // Test / Headless mock QR input (STRICTLY DEV/TEST ONLY)
  const isDevOrTest = process.env.NODE_ENV !== 'production' || window.location.hostname === 'localhost';
  const [devQrInput, setDevQrInput] = useState<string>('');

  // 1. Initial Mount & Session Check
  const checkActiveSession = useCallback(async () => {
    if (!userId) {
      setCheckingSession(false);
      return;
    }
    try {
      setCheckingSession(true);
      const res = await gymCheckoutService.getActiveSession(userId);
      if (res.session) {
        setActiveSession(res.session);
        setActiveSessionGym(res.gym);
      } else {
        setActiveSession(null);
        setActiveSessionGym(null);
      }
    } finally {
      setCheckingSession(false);
    }
  }, [userId]);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // 2. Active Session Elapsed Duration Timer (Display Only with strict unmount cleanup)
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const checkInMs = new Date(activeSession.checkInAt).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - checkInMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calculateElapsed();
    const intervalId = window.setInterval(calculateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession]);

  // Format Elapsed Time (e.g. "42m 15s" or "1h 12m 05s")
  const formatElapsedTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Format Completed Duration (e.g. "1 hr 12 mins" or "45 mins")
  const formatDurationFriendly = (durationSec: number | null | undefined) => {
    if (durationSec === null || durationSec === undefined || durationSec < 0) {
      return '< 1 min';
    }
    const mins = Math.floor(durationSec / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `${hrs} hr${hrs === 1 ? '' : 's'} ${remMins} min${remMins === 1 ? '' : 's'}`;
    }
    if (mins > 0) {
      return `${mins} min${mins === 1 ? '' : 's'}`;
    }
    return `${durationSec} sec${durationSec === 1 ? '' : 's'}`;
  };

  // 3. Start Scanner using Platform Camera Abstraction
  const handleStartScanner = async () => {
    setCheckInError(null);
    setCameraPermissionError(null);

    // Platform capability check
    if (!platform.camera.isSupported()) {
      setCameraPermissionError(
        'Camera is not supported or accessible on this device. Please grant camera permissions.'
      );
      return;
    }

    // Platform permission request
    const granted = await platform.camera.requestPermission();
    if (!granted) {
      setCameraPermissionError(
        'Camera permission was denied. Please allow camera access in your browser settings to scan the gym QR code.'
      );
      return;
    }

    setIsScanning(true);
  };

  const handleCancelScanner = () => {
    setIsScanning(false);
    setCameraPermissionError(null);
    setCheckInError(null);
  };

  // 4. Process scanned QR payload via domain checkin service
  const handleProcessQr = async (qrContent: string) => {
    if (!qrContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      setCheckInError(null);

      const result = await gymCheckinService.checkInWithQr({
        userId,
        userRole,
        rawQrContent: qrContent,
        expectedGymId: activeGym?.id,
        memberContext: {
          mode,
          activeGym,
          activeMembership,
          memberships: memberGymCtx.memberships,
        } as any,
      });

      if (!result.success) {
        if (result.isAlreadyCheckedIn && result.session) {
          setActiveSession(result.session);
          setActiveSessionGym(result.gym || activeGym);
          setIsScanning(false);
          return;
        }
        setCheckInError(result.error || 'Failed to verify gym QR code.');
        return;
      }

      // Success
      setIsScanning(false);
      setSuccessResult({
        session: result.session!,
        gym: result.gym!,
      });
      setActiveSession(result.session!);
      setActiveSessionGym(result.gym!);
      setCompletedSession(null);
      setCompletedGym(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected check-in error';
      setCheckInError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Check-Out Execution (Phase C5)
  const handleCheckOut = async () => {
    if (checkingOut || !activeSession) return;

    try {
      setCheckingOut(true);
      setCheckoutError(null);

      const result = await gymCheckoutService.checkoutCurrentSession({
        userId,
        userRole,
        checkoutMethod: 'manual_button',
      });

      if (!result.success || !result.session) {
        setCheckoutError(result.error || 'Failed to check out.');
        return;
      }

      // Successful Checkout
      setCompletedSession(result.session);
      setCompletedGym(result.gym || activeSessionGym || activeGym);
      setActiveSession(null);
      setActiveSessionGym(null);
      setSuccessResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during check-out';
      setCheckoutError(msg);
    } finally {
      setCheckingOut(false);
    }
  };

  // 6. Ineligible States Pre-checks
  if (userRole === 'gym_owner') {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Building2 size={48} style={{ color: 'var(--accent-gold)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Owner Account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-6)' }}>
            You are signed in with a gym owner account. Member QR check-in & check-out is exclusively for athlete member accounts.
          </p>
          <Link to="/owner/dashboard" className="btn btn-primary">
            Open Owner Console
          </Link>
        </div>
      </div>
    );
  }

  if (ctxLoading || checkingSession) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent-primary)', margin: '0 auto var(--space-3)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Verifying membership & visit status...</p>
      </div>
    );
  }

  // 7. COMPLETED VISIT DISPLAY (Post-Checkout Presentation)
  if (completedSession) {
    const formattedCheckIn = new Date(completedSession.checkInAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const formattedCheckOut = completedSession.checkOutAt
      ? new Date(completedSession.checkOutAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : 'Recorded';

    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid rgba(79, 140, 255, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(79, 140, 255, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
            Visit Completed
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 'var(--space-6)' }}>
            Great workout at <strong>{completedGym?.name || 'your gym'}</strong>! Your attendance visit is complete.
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 'var(--space-6)',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Facility:</span>
              <span style={{ fontWeight: 600 }}>{completedGym?.name || 'Integrated Gym'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Check-in:</span>
              <span style={{ fontWeight: 600 }}>{formattedCheckIn}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Check-out:</span>
              <span style={{ fontWeight: 600 }}>{formattedCheckOut}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Duration:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                {formatDurationFriendly(completedSession.durationSeconds)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge" style={{ background: 'rgba(79, 140, 255, 0.15)', color: 'var(--accent-primary)' }}>
                Completed Visit
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Link to="/app/workouts" className="btn btn-primary" style={{ flex: 1 }}>
                View Workout Logs
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setCompletedSession(null);
                  setCompletedGym(null);
                }}
              >
                Done
              </button>
            </div>
            <Link
              to="/app/gym/history"
              className="btn btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Clock size={16} />
              View Attendance History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 8. ACTIVE VISIT DISPLAY (Checked in - allows Check Out)
  if (activeSession) {
    const checkInTime = new Date(activeSession.checkInAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', marginBottom: 'var(--space-4)' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)',
              }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              CURRENTLY CHECKED IN
            </span>
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            {activeSessionGym?.name || activeGym?.name || 'Integrated Facility'}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-6)' }}>
            You have an active training visit at this facility. When your training session is complete, tap Check Out below.
          </p>

          {/* Checkout Error */}
          {checkoutError && (
            <div
              className="card"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#F87171',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-6)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '0.9rem',
              }}
            >
              <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{checkoutError}</div>
            </div>
          )}

          {/* Live Session Telemetry Box */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', fontWeight: 700 }}>
                Active Visit
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Check-in Time:</span>
              <span style={{ fontWeight: 600 }}>{checkInTime}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Elapsed Session Time:</span>
              </span>
              <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {formatElapsedTime(elapsedSeconds)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Verification Method:</span>
              <span style={{ fontWeight: 600 }}>QR Code (Confirmed)</span>
            </div>
          </div>

          {/* Check-Out Primary Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCheckOut}
              disabled={checkingOut}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '1rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                borderColor: '#DC2626',
              }}
            >
              {checkingOut ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Checking Out...</span>
                </>
              ) : (
                <>
                  <LogOut size={18} />
                  <span>Check Out of Gym</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Link to="/app/workouts" className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Dumbbell size={16} />
                <span>View Workouts</span>
              </Link>
              <Link to="/app/gym" className="btn btn-ghost">
                Gym Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 9. Not enrolled in integrated gym
  if (mode !== 'integrated' || !activeGym || !activeMembership) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Building2 size={44} style={{ color: 'var(--accent-primary)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            {mode === 'non_integrated' ? 'Personal Gym Mode' : 'No Integrated Gym'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-6)' }}>
            {mode === 'non_integrated'
              ? 'Personal non-integrated gyms track workouts independently and do not use digital facility QR check-in.'
              : 'Digital QR check-in requires an active membership at a FitBoost-integrated facility.'}
          </p>
          <Link to="/app/gym" className="btn btn-primary">
            Find & Join a Gym
          </Link>
        </div>
      </div>
    );
  }

  // 10. Membership not active (pending, inactive, frozen)
  if (activeMembership.status !== 'active') {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <AlertCircle size={44} style={{ color: 'var(--accent-gold)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            Membership {activeMembership.status.toUpperCase()}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 'var(--space-6)' }}>
            {activeMembership.status === 'pending'
              ? `Your membership request for ${activeGym.name} is currently awaiting approval from gym staff.`
              : `Your membership at ${activeGym.name} is currently ${activeMembership.status}. Please contact the facility desk.`}
          </p>
          <Link to="/app/gym" className="btn btn-secondary">
            View Gym Directory
          </Link>
        </div>
      </div>
    );
  }

  // 11. Fresh Check-In Confirmation Card
  if (successResult) {
    const formattedCheckIn = new Date(successResult.session.checkInAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
            You're Checked In!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 'var(--space-6)' }}>
            Welcome to <strong>{successResult.gym.name}</strong>. Your attendance session has started.
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 'var(--space-6)',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Facility:</span>
              <span style={{ fontWeight: 600 }}>{successResult.gym.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Time:</span>
              <span style={{ fontWeight: 600 }}>{formattedCheckIn}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)' }}>
                Active Session
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Verification:</span>
              <span style={{ fontWeight: 600 }}>QR Scan Confirmed</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                setSuccessResult(null);
              }}
            >
              Continue to Active Session
            </button>
            <Link to="/app/workouts" className="btn btn-secondary">
              Workouts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 12. Standard Ready to Scan / Scanning View (Not Checked In)
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '640px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(79, 140, 255, 0.12)',
            color: 'var(--accent-primary)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: 'var(--space-2)',
          }}
        >
          <QrCode size={14} />
          <span>ATTENDANCE CHECK-IN</span>
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>
          Scan Gym QR
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Scan the FitBoost QR displayed at <strong>{activeGym.name}</strong> to start your visit.
        </p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Link
            to="/app/gym/history"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--accent-primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <Clock size={14} />
            <span>View Attendance History →</span>
          </Link>
        </div>
      </div>

      {/* Camera Permission / Access Error */}
      {cameraPermissionError && (
        <div
          className="card"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Camera Error:</strong> {cameraPermissionError}
          </div>
        </div>
      )}

      {/* Check-In Service Error */}
      {checkInError && (
        <div
          className="card"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <XCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{checkInError}</div>
        </div>
      )}

      {/* Main Scanner Container */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}
      >
        {!isScanning ? (
          <div>
            {/* Facility Context Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 'var(--space-6)',
                textAlign: 'left',
              }}
            >
              <Building2 size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{activeGym.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} />
                  <span>{activeGym.address}, {activeGym.city}</span>
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', fontSize: '0.75rem' }}>
                Active Pass
              </span>
            </div>

            {/* Instruction Callout */}
            <div style={{ margin: 'var(--space-8) 0' }}>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(79, 140, 255, 0.1)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  border: '1px dashed rgba(79, 140, 255, 0.4)',
                }}
              >
                <QrCode size={48} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '380px', margin: '0 auto' }}>
                Position your camera directly over the official FitBoost QR poster at the gym entrance.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartScanner}
              disabled={submitting}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '1rem',
              }}
            >
              <Camera size={18} />
              <span>Open Scanner & Check In</span>
            </button>
          </div>
        ) : (
          /* Active Scanning Viewport */
          <div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1',
                maxHeight: '340px',
                background: '#0a0d14',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                margin: '0 auto var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--accent-primary)',
              }}
            >
              {/* Camera viewfinder frame */}
              <div
                style={{
                  width: '70%',
                  height: '70%',
                  border: '2px solid rgba(79, 140, 255, 0.8)',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                }}
              >
                {/* Laser animation bar */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 8px var(--accent-primary)',
                  }}
                />
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  color: 'white',
                  fontSize: '0.8rem',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                Align FitBoost QR within frame
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelScanner}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Headless & Automated Test Helper (Dev / Test ONLY) */}
        {isDevOrTest && (
          <div
            style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px dashed var(--border-subtle)',
              textAlign: 'left',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <ShieldCheck size={14} style={{ color: 'var(--accent-gold)' }} />
              <strong>Automated Test & Dev Helper (Non-Prod):</strong>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Paste canonical fitboost_qr_... code"
                value={devQrInput}
                onChange={e => setDevQrInput(e.target.value)}
                className="input"
                style={{ flex: 1, fontSize: '0.8rem', padding: '4px 8px' }}
                id="dev-qr-test-input"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleProcessQr(devQrInput)}
                disabled={!devQrInput.trim() || submitting}
                id="dev-qr-test-submit"
              >
                Simulate Scan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
