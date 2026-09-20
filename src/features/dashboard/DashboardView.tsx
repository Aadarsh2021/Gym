import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Flame,
  Utensils,
  ChevronRight,
  Zap,
  CheckCircle2,
  Moon,
  ArrowRight,
  Activity,
  Trophy,
  Sparkles,
  MapPin,
  AlertTriangle,
  Loader2,
  X,
  Target,
  Gift,
  Building2,
  Users,
  QrCode,
  MessageSquare,
  ShieldAlert,
  Calendar,
  Megaphone,
  Compass,
} from 'lucide-react';
import { WorkoutPlan, WorkoutSession, WorkoutPlanDay } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile, DailyMacroTotals } from '@/types/nutrition.types';
import { FitnessProfile } from '@/types/user.types';
import { getGoalContextDetails } from '@/domain/goal-context';
import { AuthSession } from '@/services/auth.service';
import { getTodaysScheduledWorkout } from '@/domain/scheduled-workout';
import { streakService } from '@/services/streak.service';
import { calculateWorkoutSummary } from '@/domain/workout-tonnage';
import { dailyMissionService } from '@/services/daily-mission.service';
import { DailyMission, getMissionMeta, getMissionProgressPercent } from '@/domain/daily-mission';
import { getQualityScoreMeta } from '@/domain/workout-quality';
import { isToday, getTodayIST } from '@/utils/date';
import { isWithinGymRadius } from '@/utils/geo';
import { PRODUCT_NAME } from '@/config/branding';
import { platform } from '@/platform';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymRepository } from '@/repositories/gym.repository';
import { GymAnnouncement } from '@/types/gym.types';

interface DashboardViewProps {
  activePlan: WorkoutPlan | null;
  streak: UserStreak;
  nutritionProfile: NutritionProfile | null;
  fitnessProfile?: FitnessProfile | null;
  dailyTotals?: DailyMacroTotals;
  recentSessions?: WorkoutSession[];
  coins?: number;
  session?: AuthSession;
  onStartWorkout: (day?: WorkoutPlanDay, gymVerified?: boolean) => void;
  onStartQuickWorkout?: (day?: WorkoutPlanDay, gymVerified?: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activePlan,
  streak,
  nutritionProfile,
  fitnessProfile,
  dailyTotals,
  recentSessions = [],
  coins = 0,
  session,
  onStartWorkout,
  onStartQuickWorkout,
}) => {
  // Pure deterministic scheduler calculation
  const scheduleResult = useMemo(() => {
    return getTodaysScheduledWorkout({
      activePlan,
      currentDate: new Date(),
      completedSessions: recentSessions,
    });
  }, [activePlan, recentSessions]);

  // Goal context derivation with full null-safety
  const goalContext = useMemo(() => {
    return getGoalContextDetails(fitnessProfile?.goal);
  }, [fitnessProfile?.goal]);

  const scheduledDay = scheduleResult.scheduledDay;
  const [restDayLogged, setRestDayLogged] = useState(false);

  // Onboarding Guard State Logic (States A, B, C)
  const hasProfileAndGoal = Boolean(fitnessProfile && fitnessProfile.goal);
  const hasActivePlan = Boolean(activePlan);
  const isStateA = !hasProfileAndGoal;
  const isStateB = hasProfileAndGoal && !hasActivePlan;

  // State A session-only dismissal
  const [dismissedStateA, setDismissedStateA] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('dismiss_dashboard_state_a') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissStateA = () => {
    try {
      sessionStorage.setItem('dismiss_dashboard_state_a', 'true');
    } catch {}
    setDismissedStateA(true);
  };

  // Authoritative Member Gym Context
  let memberGymContext: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymContext = useMemberGymContext();
  } catch {
    // Safe fallback for standalone tests
  }

  const isIntegratedGym = memberGymContext?.mode === 'integrated' && Boolean(memberGymContext?.activeGym);
  const activeGym = memberGymContext?.activeGym;

  const [gymAnnouncements, setGymAnnouncements] = useState<GymAnnouncement[]>([]);
  useEffect(() => {
    let mounted = true;
    if (activeGym?.id) {
      gymRepository
        .fetchGymAnnouncements(activeGym.id, false)
        .then(list => {
          if (mounted) setGymAnnouncements(list.slice(0, 1));
        })
        .catch(() => {
          if (mounted) setGymAnnouncements([]);
        });
    } else {
      setGymAnnouncements([]);
    }
    return () => {
      mounted = false;
    };
  }, [activeGym?.id]);

  // Daily Mission State
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null);
  const [isClaimingMission, setIsClaimingMission] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

  // Stabilize dependencies to prevent infinite re-render query storms
  const sessionFingerprint = useMemo(
    () => recentSessions.map(s => `${s.id}:${s.status}`).join('|'),
    [recentSessions]
  );
  const macroFingerprint = dailyTotals ? `${dailyTotals.totalCalories}:${dailyTotals.totalProteinG}` : 'none';

  useEffect(() => {
    let isMounted = true;
    dailyMissionService.getTodayMission().then(mission => {
      if (isMounted && mission) {
        setDailyMission(prev => {
          if (
            prev &&
            prev.id === mission.id &&
            prev.progressValue === mission.progressValue &&
            prev.isCompleted === mission.isCompleted &&
            prev.isClaimable === mission.isClaimable
          ) {
            return prev;
          }
          return mission;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [sessionFingerprint, macroFingerprint]);

  const handleClaimMission = async () => {
    if (!dailyMission || isClaimingMission) return;
    setIsClaimingMission(true);
    setClaimFeedback(null);
    try {
      const res = await dailyMissionService.claimMission(dailyMission.id);
      if (res.success) {
        setClaimFeedback(`+${res.result?.coinsAwarded || 15} Coins Claimed!`);
        const updated = await dailyMissionService.getTodayMission();
        if (updated) setDailyMission(updated);
      } else {
        setClaimFeedback(res.error || 'Unable to claim reward.');
      }
    } finally {
      setIsClaimingMission(false);
    }
  };

  // Gym Geofencing Check State
  const [gymModalOpen, setGymModalOpen] = useState(false);
  const [gymCheckStatus, setGymCheckStatus] = useState<'checking' | 'verified' | 'outside' | 'error'>('checking');
  const [gymDistanceMeters, setGymDistanceMeters] = useState<number | null>(null);
  const [pendingWorkoutDay, setPendingWorkoutDay] = useState<WorkoutPlanDay | undefined>(undefined);
  const [pendingWorkoutMode, setPendingWorkoutMode] = useState<'standard' | 'quick'>('standard');

  const performGymVerification = (day?: WorkoutPlanDay, mode: 'standard' | 'quick' = 'standard') => {
    setPendingWorkoutDay(day);
    setPendingWorkoutMode(mode);
    setGymModalOpen(true);
    setGymCheckStatus('checking');
    setGymDistanceMeters(null);

    if (!platform.location.isSupported() || !fitnessProfile?.gymLatitude || !fitnessProfile?.gymLongitude) {
      setGymCheckStatus('error');
      return;
    }

    platform.location
      .getCurrentPosition({ enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 })
      .then(coords => {
        const res = isWithinGymRadius(
          coords.latitude,
          coords.longitude,
          fitnessProfile.gymLatitude as number,
          fitnessProfile.gymLongitude as number,
          fitnessProfile.gymRadiusMeters || 200
        );
        setGymDistanceMeters(res.distanceMeters);
        setGymCheckStatus(res.isNearby ? 'verified' : 'outside');
      })
      .catch(() => {
        setGymCheckStatus('error');
      });
  };

  const handleStartWorkoutWithCheck = (day?: WorkoutPlanDay, mode: 'standard' | 'quick' = 'standard') => {
    platform.audio.unlockAudio?.();
    if (fitnessProfile?.gymLatitude && fitnessProfile?.gymLongitude) {
      performGymVerification(day, mode);
    } else {
      if (mode === 'quick' && onStartQuickWorkout) {
        onStartQuickWorkout(day, false);
      } else {
        onStartWorkout(day, false);
      }
    }
  };

  const handleConfirmStart = () => {
    platform.audio.unlockAudio?.();
    setGymModalOpen(false);
    const isVerified = gymCheckStatus === 'verified';
    if (pendingWorkoutMode === 'quick' && onStartQuickWorkout) {
      onStartQuickWorkout(pendingWorkoutDay, isVerified);
    } else {
      onStartWorkout(pendingWorkoutDay, isVerified);
    }
  };

  const handleMarkRestDay = async () => {
    if (!session?.user?.id) return;
    await streakService.logRestDay(session.user.id);
    setRestDayLogged(true);
  };

  // Today's Fitness Summary Aggregation (IST Date Matching)
  const todaySession = useMemo(() => {
    return recentSessions.find(s => isToday(s.startedAt) && s.status === 'completed');
  }, [recentSessions]);

  const workoutSummary = useMemo(() => {
    return todaySession ? calculateWorkoutSummary(todaySession) : null;
  }, [todaySession]);

  const hasActivityToday = Boolean(todaySession || (dailyTotals && dailyTotals.entriesCount > 0));

  // User details & Greeting
  const displayName =
    session?.profile?.displayName ||
    session?.user?.email?.split('@')[0] ||
    'Athlete';
  const firstName = displayName.split(' ')[0];

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 17
      ? 'Good afternoon'
      : currentHour < 21
      ? 'Good evening'
      : 'Good night';

  return (
    <div className="container-app animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* 0. ONBOARDING COMPLETION GUARD & DASHBOARD GUIDANCE BANNERS */}
      {isStateA && !dismissedStateA && (
        <div
          className="card card-elevated animate-fade-in"
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.05) 100%)',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(249, 115, 22, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-fire)',
              }}
            >
              <Target size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Finish Setting Up Your Athlete Profile
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Set your personal fitness goals and biometrics to unlock structured training routines and accurate nutrition targets.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Link
              to="/onboarding"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Complete Setup →
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleDismissStateA}
              aria-label="Dismiss banner for session"
              style={{ color: 'var(--text-muted)', padding: '6px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {isStateB && (
        <div
          className="card card-elevated animate-fade-in"
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(79, 70, 229, 0.05) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-indigo, #818cf8)',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Build Your Structured Training Split
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Your athlete profile is ready. Build a science-backed workout plan matched to your target goal.
              </p>
            </div>
          </div>

          <Link
            to="/plan/build"
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Generate Workout Plan →
          </Link>
        </div>
      )}

      {/* Personalized Welcome Banner */}
      <div className="dashboard-welcome-banner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span className="badge badge-accent" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              {PRODUCT_NAME} PRO
            </span>
            {fitnessProfile?.goal && goalContext?.label && goalContext.label !== 'undefined' && (
              <span
                className="badge"
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  background: goalContext.badgeStyle?.bg,
                  color: goalContext.badgeStyle?.color,
                  border: goalContext.badgeStyle?.border,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Target size={12} />
                Goal: {goalContext.label}
              </span>
            )}
            <span
              className="badge badge-accent"
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                letterSpacing: '0.04em',
              }}
            >
              <Zap size={12} fill="var(--accent-primary)" />
              PRO ATHLETE
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </span>
        </div>

        <h1
          style={{
            fontSize: '2.1rem',
            fontWeight: 800,
            margin: '0 0 var(--space-2)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
          }}
        >
          {timeGreeting}, {firstName}! <span>⚡</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.98rem', maxWidth: '720px', lineHeight: 1.6 }}>
          {scheduleResult.status === 'completed_today'
            ? 'Workout crushed today! Lock in your nutrition recovery, track your macros, and prepare for tomorrow’s session.'
            : scheduleResult.status === 'rest_day'
            ? 'Scheduled recovery day. Rest, refuel your muscles, and recharge your central nervous system for your next session.'
            : scheduleResult.status === 'no_plan'
            ? 'Welcome to your training dashboard. Generate or assign your workout routine to start crushing your goals.'
            : `Today’s objective is ${scheduledDay?.name || 'Workout Session'}. Hit your target sets, log your weights, and stay consistent.`}
        </p>
        {fitnessProfile?.goal && goalContext?.subtitle && goalContext.subtitle !== 'undefined' && (
          <div
            style={{
              marginTop: 'var(--space-2)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ color: goalContext.badgeStyle?.color || 'var(--accent-primary)', fontWeight: 600 }}>Goal Target:</span>
            <span>{goalContext.subtitle}</span>
          </div>
        )}
      </div>

      {/* ====================================================================
          CONTEXT A/B/C: MEMBER GYM CONTEXTUAL HERO STRIP
          ==================================================================== */}
      {/* 1. INTEGRATED COMPANY GYM COMMAND CENTER */}
      {isIntegratedGym && activeGym && (
        <div
          className="card-gym-command animate-fade-in"
          style={{ marginBottom: 'var(--space-5)' }}
          data-testid="gym-command-center"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(79, 140, 255, 0.16)',
                  border: '1px solid rgba(79, 140, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeGym.name}
                  </h3>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(34, 197, 94, 0.16)',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      padding: '2px 6px',
                    }}
                  >
                    Active Facility
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {[activeGym.address, activeGym.city].filter(Boolean).join(', ') || 'Connected Partner Facility'}
                </p>
              </div>
            </div>

            {/* Quick Check-In CTA */}
            <Link
              to="/app/gym/check-in"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '0 var(--space-4)',
                minHeight: '40px',
                fontWeight: 700,
              }}
            >
              <QrCode size={18} />
              <span>Facility Check-In</span>
            </Link>
          </div>

          {/* Urgent/Pinned Announcement Ticker if present */}
          {gymAnnouncements.length > 0 && (
            <div
              style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: '0.82rem',
              }}
            >
              <Megaphone size={15} color="var(--color-warning)" />
              <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>Notice:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{gymAnnouncements[0].title}</span>
              <span style={{ color: 'var(--text-muted)' }}>— {gymAnnouncements[0].content.slice(0, 80)}...</span>
            </div>
          )}

          {/* Quick Module Jump Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Link to="/app/gym/community" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <MessageSquare size={14} />
              <span>Community</span>
            </Link>
            <Link to="/app/gym/buddies" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Users size={14} />
              <span>Buddies</span>
            </Link>
            <Link to="/app/gym/challenges" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Trophy size={14} />
              <span>Challenges</span>
            </Link>
            <Link to="/app/gym/events" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Calendar size={14} />
              <span>Events</span>
            </Link>
            <Link to="/app/gym/safety" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <ShieldAlert size={14} />
              <span>Safety SOS</span>
            </Link>
          </div>
        </div>
      )}

      {/* 2. EXTERNAL COMMERCIAL GYM CONTEXTUAL BADGE */}
      {memberGymContext?.mode === 'non_integrated' && (
        <div
          className="animate-fade-in"
          style={{
            marginBottom: 'var(--space-5)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
          data-testid="external-gym-banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span className="card-external-badge">
              <Building2 size={13} />
              Commercial Gym Mode
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Workouts are automatically configured for commercial equipment (Barbells, Cables, Dumbbells, Machines).
            </span>
          </div>
          <Link
            to="/app/gym"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', padding: '0 8px' }}
          >
            Explore Partner Gyms →
          </Link>
        </div>
      )}

      {/* Athlete Status & Quick Glance Strip (4 3D Glass Cards) */}
      <div className="athlete-strip-grid">
        {/* Card 1: Today's Mission Status */}
        <div
          className="card card-interactive"
          onClick={() => {
            if (scheduledDay && scheduleResult.status === 'scheduled') {
              handleStartWorkoutWithCheck(scheduledDay, 'standard');
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            cursor: scheduledDay && scheduleResult.status === 'scheduled' ? 'pointer' : 'default',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            style={{
              padding: '10px',
              background:
                scheduleResult.status === 'completed_today'
                  ? 'var(--color-success-muted)'
                  : scheduleResult.status === 'rest_day'
                  ? 'var(--accent-indigo-muted)'
                  : 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color:
                scheduleResult.status === 'completed_today'
                  ? 'var(--color-success)'
                  : scheduleResult.status === 'rest_day'
                  ? 'var(--color-info)'
                  : 'var(--accent-primary)',
            }}
          >
            {scheduleResult.status === 'completed_today' ? (
              <CheckCircle2 size={22} />
            ) : scheduleResult.status === 'rest_day' ? (
              <Moon size={22} />
            ) : (
              <Zap size={22} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Today's Mission
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest Day' : 'Setup Plan'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {scheduleResult.status === 'completed_today' ? 'Done ✓' : scheduleResult.status === 'rest_day' ? 'Recovery' : 'Start Session →'}
            </span>
          </div>
        </div>

        {/* Card 2: Active Routine */}
        <Link
          to="/app/workouts"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              padding: '10px',
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
            }}
          >
            <Zap size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Split
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activePlan ? activePlan.name : 'No Active Plan'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {activePlan ? `${activePlan.days.length} Days / Week →` : 'Build Plan →'}
            </span>
          </div>
        </Link>

        {/* Card 3: Consistency Streak */}
        <Link
          to="/app/streaks"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              padding: '10px',
              background: 'var(--accent-primary-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
            }}
          >
            <Flame size={22} fill="var(--accent-primary)" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Streak Record
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {streak.currentStreak} Days Active
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {coins > 0 ? `${coins} Coins • ` : ''}Longest: {streak.longestStreak}d →
            </span>
          </div>
        </Link>

        {/* Card 4: Daily Energy & Nutrition */}
        <Link
          to="/app/nutrition"
          className="card card-interactive"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
        >
          <div
            style={{
              padding: '10px',
              background: 'var(--color-success-muted)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-success)',
            }}
          >
            <Utensils size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Daily Fuel
            </small>
            <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.totalCalories} / ${nutritionProfile?.targetCalories || 2200} kcal`
                : nutritionProfile ? `${nutritionProfile.targetCalories} kcal` : '2,200 kcal'}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.totalProteinG}g / ${nutritionProfile?.targetProteinG || 140}g Protein →`
                : nutritionProfile ? `${nutritionProfile.targetProteinG}g Protein Goal →` : '140g Protein Goal →'}
            </span>
          </div>
        </Link>
      </div>

      {/* DAILY MISSION CARD */}
      {dailyMission && (
        <div
          className="card card-elevated"
          style={{
            marginBottom: 'var(--space-6)',
            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95), rgba(39, 39, 42, 0.95))',
            borderColor: dailyMission.isCompleted
              ? 'rgba(114, 184, 121, 0.4)'
              : dailyMission.isClaimable
              ? 'rgba(234, 179, 8, 0.4)'
              : 'var(--border-medium)',
            padding: 'var(--space-4) var(--space-5)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: '240px', flex: 1 }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {getMissionMeta(dailyMission.missionType).icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px', flexWrap: 'wrap' }}>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Today's Daily Mission
                  </small>
                  <span className={`badge ${getMissionMeta(dailyMission.missionType).bgColor} ${getMissionMeta(dailyMission.missionType).textColor} ${getMissionMeta(dailyMission.missionType).borderColor}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                    {getMissionMeta(dailyMission.missionType).badge}
                  </span>
                  {dailyMission.isCompleted && (
                    <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      ✓ Completed
                    </span>
                  )}
                  {dailyMission.isExpired && !dailyMission.isCompleted && (
                    <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 6px', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                      Expired
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 2px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {dailyMission.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {dailyMission.description}
                </p>
              </div>
            </div>

            {/* Progress & Claim CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '130px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontWeight: 700, color: dailyMission.isClaimable || dailyMission.isCompleted ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                    {dailyMission.progressValue ?? 0} / {dailyMission.targetValue}
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${getMissionProgressPercent(dailyMission.progressValue ?? 0, dailyMission.targetValue)}%`,
                      background: dailyMission.isCompleted
                        ? 'var(--color-success)'
                        : dailyMission.isClaimable
                        ? 'var(--accent-primary)'
                        : 'var(--accent-primary)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {dailyMission.isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'rgba(114, 184, 121, 0.12)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(114, 184, 121, 0.3)', color: 'var(--color-success)', fontSize: '0.84rem', fontWeight: 600 }}>
                    <CheckCircle2 size={15} /> +{dailyMission.coinReward} Coins Earned
                  </div>
                ) : dailyMission.isClaimable ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleClaimMission}
                    disabled={isClaimingMission}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isClaimingMission ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                    Claim +{dailyMission.coinReward} Coins
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                    <Flame size={14} color="var(--accent-primary)" /> +{dailyMission.coinReward} Coins
                  </div>
                )}
              </div>
            </div>
          </div>
          {claimFeedback && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: '0.8rem', color: claimFeedback.includes('+') ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 600 }}>
              {claimFeedback}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Mission + Coach */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* TODAY'S MISSION CARD (Modern Graphite Elevated) */}
        <div
          className="card card-elevated"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--border-medium)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div>
            {/* Header of Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '11px',
                    background:
                      scheduleResult.status === 'completed_today'
                        ? 'var(--color-success-muted)'
                        : scheduleResult.status === 'rest_day'
                        ? 'var(--accent-indigo-muted)'
                        : 'var(--accent-primary-muted)',
                    borderRadius: 'var(--radius-sm)',
                    color:
                      scheduleResult.status === 'completed_today'
                        ? 'var(--color-success)'
                        : scheduleResult.status === 'rest_day'
                        ? 'var(--color-info)'
                        : 'var(--accent-primary)',
                  }}
                >
                  {scheduleResult.status === 'completed_today' ? (
                    <CheckCircle2 size={24} />
                  ) : scheduleResult.status === 'rest_day' ? (
                    <Moon size={24} />
                  ) : (
                    <Zap size={24} />
                  )}
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    {scheduleResult.status === 'completed_today'
                      ? 'Session Complete'
                      : scheduleResult.status === 'rest_day'
                      ? 'Recovery Window'
                      : scheduleResult.status === 'no_plan'
                      ? 'Setup Required'
                      : "Today's Routine"}
                  </small>
                  <h3 style={{ fontSize: '1.35rem', margin: '2px 0 0', fontWeight: 700 }}>
                    {scheduledDay ? scheduledDay.name : scheduleResult.status === 'rest_day' ? 'Rest & Recovery Day' : 'Build Your Training Plan'}
                  </h3>
                </div>
              </div>

              {scheduledDay && (
                <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                  Day {scheduledDay.dayNumber}
                </span>
              )}
            </div>

            {/* Content Based on Scheduler Status */}
            {scheduleResult.status === 'no_plan' ? (
              /* NO PLAN STATE */
              <div style={{ padding: 'var(--space-4) 0 var(--space-6)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.95rem' }}>
                  You don't have an active training plan yet. Generate a personalized routine matched to your equipment and schedule.
                </p>
                <Link to="/plan/build" className="btn btn-primary btn-block btn-lg" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Create My Plan <ArrowRight size={18} />
                </Link>
              </div>
            ) : scheduleResult.status === 'completed_today' ? (
              /* COMPLETED TODAY STATE */
              <div style={{ padding: 'var(--space-2) 0 var(--space-4)' }}>
                <p style={{ fontSize: '0.94rem', color: 'var(--color-success)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <CheckCircle2 size={18} /> Great work! Today's session was successfully logged.
                </p>
                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next scheduled session: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {scheduleResult.nextScheduledWorkout.day.name} ({scheduleResult.nextScheduledWorkout.dayOfWeekName})
                    </strong>
                  </div>
                )}
              </div>
            ) : scheduleResult.status === 'rest_day' ? (
              /* REST DAY STATE */
              <div style={{ padding: 'var(--space-2) 0 var(--space-4)' }}>
                <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                  Muscle protein synthesis and neurological recovery happen while resting. Prioritize hydration and hit your protein target today.
                </p>

                {scheduleResult.nextScheduledWorkout && (
                  <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next training day: </span>
                    <strong style={{ color: 'var(--accent-primary)' }}>
                      {scheduleResult.nextScheduledWorkout.day.name} ({scheduleResult.nextScheduledWorkout.dayOfWeekName})
                    </strong>
                  </div>
                )}

                {/* Off-schedule recovery / catchup */}
                {scheduleResult.missedPreviousWorkout && !restDayLogged && (
                  <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--space-2)', lineHeight: 1.4 }}>
                      Missed previous session ({scheduleResult.missedPreviousWorkout.name})? You can make it up today or log it as an active recovery day to keep your streak intact.
                    </small>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStartWorkoutWithCheck(scheduleResult.missedPreviousWorkout!, 'standard')}
                      >
                        Make Up Session
                      </button>
                      {onStartQuickWorkout && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartWorkoutWithCheck(scheduleResult.missedPreviousWorkout!, 'quick')}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Zap size={14} color="#eab308" /> Quick (15m)
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleMarkRestDay}
                      >
                        Mark as Rest Day
                      </button>
                    </div>
                  </div>
                )}

                {restDayLogged && (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-success-muted)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: '0.82rem' }}>
                    ✓ Rest day logged. Consistency streak preserved!
                  </div>
                )}
              </div>
            ) : (
              /* SCHEDULED TODAY STATE */
              scheduledDay && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <p style={{ fontSize: '0.92rem', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    Target muscle groups: <strong style={{ color: 'var(--text-primary)' }}>{scheduledDay.targetMuscleGroups.join(', ')}</strong>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {scheduledDay.exercises.slice(0, 3).map((ex, i) => (
                      <div
                        key={ex.id || i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.88rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.exercise?.name || 'Compound Movement'}</span>
                        <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', background: 'var(--accent-primary-muted)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                          {ex.targetSets} sets × {ex.targetRepsMin}-{ex.targetRepsMax}
                        </span>
                      </div>
                    ))}
                    {scheduledDay.exercises.length > 3 && (
                      <small style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '4px' }}>
                        +{scheduledDay.exercises.length - 3} more exercises in today's split
                      </small>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Action Button */}
          {scheduleResult.status === 'scheduled' && scheduledDay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => handleStartWorkoutWithCheck(scheduledDay, 'standard')}>
                <Play size={20} fill="var(--accent-primary-text)" /> Start Today's Workout
              </button>
              {onStartQuickWorkout && (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => handleStartWorkoutWithCheck(scheduledDay, 'quick')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}
                >
                  <Zap size={16} color="#eab308" /> Short on Time? 15-Min Quick Workout
                </button>
              )}
            </div>
          )}

          {scheduleResult.status === 'completed_today' && (
            <Link to="/app/progress" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
              View Workout Summary & PRs
            </Link>
          )}
        </div>

        {/* DAILY NUTRITION TARGETS CARD (Modern Graphite Elevated) */}
        <Link
          to="/app/nutrition"
          className="card card-elevated card-interactive"
          style={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--border-medium)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div
                  style={{
                    padding: '10px',
                    background: 'var(--accent-primary-muted)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Utensils size={22} />
                </div>
                <div>
                  <small style={{ color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
                    Daily Nutrition Targets
                  </small>
                  <h3 style={{ fontSize: '1.25rem', margin: '2px 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>Macro & Calorie Fuel</h3>
                </div>
              </div>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                Active Target
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', margin: 'var(--space-4) 0' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calories (Consumed / Target)</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {dailyTotals ? dailyTotals.totalCalories : 0}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {nutritionProfile ? nutritionProfile.targetCalories : 2200}
                  </span>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>kcal</small>
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protein (Consumed / Target)</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {dailyTotals ? dailyTotals.totalProteinG : 0}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {nutritionProfile ? nutritionProfile.targetProteinG : 140}
                  </span>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>g</small>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 var(--space-2)' }}>
              {dailyTotals && dailyTotals.entriesCount > 0
                ? `${dailyTotals.entriesCount} meal item${dailyTotals.entriesCount > 1 ? 's' : ''} logged today. Target remaining: ${Math.max(0, (nutritionProfile?.targetCalories || 2200) - dailyTotals.totalCalories)} kcal and ${Math.max(0, Math.round(((nutritionProfile?.targetProteinG || 140) - dailyTotals.totalProteinG) * 10) / 10)}g protein.`
                : goalContext.nutritionHint}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: '0.86rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              View Nutrition Plan & Food Diary →
            </span>
            <ChevronRight size={18} color="var(--accent-primary)" />
          </div>
        </Link>
      </div>

      {/* TODAY'S PERFORMANCE RECAP / DAILY FITNESS SUMMARY */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Activity size={22} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>Today's Fitness Summary</h2>
          </div>
          <span className="badge badge-accent" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
            TODAY'S RECAP
          </span>
        </div>

        {!hasActivityToday ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <Sparkles size={28} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-2)' }} />
            <h4 style={{ margin: '0 0 var(--space-1)', fontSize: '1.05rem' }}>No Activity Recorded Today Yet</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
              Complete today's scheduled training session or log your meals in the nutrition diary to generate your daily performance recap.
            </p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-4)' }}>
            {/* 1. Workout Recap */}
            <div className="card" style={{ padding: 'var(--space-5)', background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    Training Session
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {todaySession?.gymVerified && (
                      <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(127, 166, 107, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(127, 166, 107, 0.3)' }}>
                        ✓ Gym Verified
                      </span>
                    )}
                    {todaySession ? (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Completed</span>
                    ) : (
                      <span className="badge" style={{ fontSize: '0.7rem' }}>Pending</span>
                    )}
                  </div>
                </div>

                {todaySession ? (
                  <>
                    <h4 style={{ margin: '0 0 var(--space-2)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      {todaySession.name}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Duration</small>
                        <strong style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                          {Math.round(todaySession.durationSeconds / 60)}m
                        </strong>
                      </div>
                      <div style={{ padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Sets Done</small>
                        <strong style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                          {workoutSummary?.totalCompletedSets || 0}
                        </strong>
                      </div>
                      <div style={{ padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Volume</small>
                        <strong style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                          {workoutSummary?.totalVolumeKg || 0} kg
                        </strong>
                      </div>
                    </div>

                    {/* Exertion Feedback Rating */}
                    {todaySession.sessionRating && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Workout Feedback:</span>
                        <strong style={{ textTransform: 'capitalize', color: todaySession.sessionRating === 'exhausting' ? 'var(--color-warning)' : todaySession.sessionRating === 'easy' ? 'var(--color-success)' : 'var(--accent-primary)' }}>
                          {todaySession.sessionRating === 'easy' ? 'Easy (Recovery)' : todaySession.sessionRating === 'normal' ? 'Normal (Target RPE)' : 'Exhausting (Max Effort)'}
                        </strong>
                      </div>
                    )}

                    {/* Authoritative Quality Score Badge */}
                    {todaySession.qualityScore !== null && todaySession.qualityScore !== undefined && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Quality Score:</span>
                        <span className={`badge ${getQualityScoreMeta(todaySession.qualityScore).badgeColor}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {todaySession.qualityScore}/100 ({getQualityScoreMeta(todaySession.qualityScore).tier})
                        </span>
                      </div>
                    )}

                    {workoutSummary && workoutSummary.newPersonalRecords.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(234, 179, 8, 0.12)', borderRadius: 'var(--radius-sm)', color: '#eab308', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Trophy size={14} /> {workoutSummary.newPersonalRecords.length} New Personal Record{workoutSummary.newPersonalRecords.length > 1 ? 's' : ''}!
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 'var(--space-2) 0 var(--space-4)' }}>
                    No training session logged today yet. Launch your workout to build consistency.
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <Link to="/app/workouts" style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{todaySession ? 'View Full Session Logs' : 'Open Workout Hub'}</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            {/* 2. Nutrition Intake Recap */}
            <div className="card" style={{ padding: 'var(--space-5)', background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    Nutrition & Macros
                  </span>
                  <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                    {dailyTotals?.entriesCount || 0} Items Logged
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  {/* Calorie Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Energy</span>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {dailyTotals?.totalCalories || 0} / {nutritionProfile?.targetCalories || 2200} kcal
                      </span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round(((dailyTotals?.totalCalories || 0) / (nutritionProfile?.targetCalories || 2200)) * 100))}%`,
                          background: 'var(--accent-primary)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Protein Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Protein Target</span>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                        {dailyTotals?.totalProteinG || 0}g / {nutritionProfile?.targetProteinG || 140}g
                      </span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round(((dailyTotals?.totalProteinG || 0) / (nutritionProfile?.targetProteinG || 140)) * 100))}%`,
                          background: 'var(--color-success)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Mini Macro Breakdown: Carbs, Fat, Fiber */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: '2px' }}>
                    <div style={{ padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'block' }}>Carbs</small>
                      <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}>{dailyTotals?.totalCarbsG ?? 0}g</strong>
                    </div>
                    <div style={{ padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'block' }}>Fat</small>
                      <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}>{dailyTotals?.totalFatG ?? 0}g</strong>
                    </div>
                    <div style={{ padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.68rem', display: 'block' }}>Fibre</small>
                      <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}>{dailyTotals?.totalFiberG ?? 0}g</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <Link to="/app/nutrition" style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Open Food Diary</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            {/* 3. Consistency & Streak Recap */}
            <div className="card" style={{ padding: 'var(--space-5)', background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    Consistency & Rewards
                  </span>
                  <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                    {coins} Coins
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ padding: '12px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                    <Flame size={28} fill="var(--accent-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {streak.currentStreak} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Day Streak</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      Longest: {streak.longestStreak} consecutive days
                    </small>
                  </div>
                </div>

                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
                    {todaySession || streak.lastActivityDate === getTodayIST() ? (
                      <>
                        <CheckCircle2 size={16} color="var(--color-success)" />
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Streak preserved for today!</span>
                      </>
                    ) : (
                      <>
                        <Zap size={16} color="#eab308" />
                        <span style={{ color: 'var(--text-secondary)' }}>Log session today to maintain streak</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <Link to="/app/streaks" style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>View Rewards & Coin Ledger</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Non-Integrated Gym Discovery Spotlight */}
      {!isIntegratedGym && (
        <div
          className="card card-elevated animate-fade-in"
          style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
          data-testid="gym-discovery-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(79, 140, 255, 0.12)',
                border: '1px solid rgba(79, 140, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Compass size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Train at an Integrated FitSphere Gym?
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Connect with verified partner facilities to unlock automated QR check-in, community feeds, gym buddies, and events.
              </p>
            </div>
          </div>
          <Link to="/app/gym" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
            <span>Explore Gyms</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Gym Location Verification Soft Check Modal */}
      {gymModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card card-elevated animate-fade-in"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: 'var(--space-6)',
              position: 'relative',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <MapPin size={20} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Gym Check-In</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setGymModalOpen(false)}
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
              {gymCheckStatus === 'checking' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <Loader2 size={36} className="animate-spin" color="var(--accent-primary)" />
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Verifying proximity to your registered gym...
                  </p>
                </div>
              )}

              {gymCheckStatus === 'verified' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--color-success-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={32} color="var(--color-success)" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-success)', fontWeight: 700 }}>
                      Facility Check-In Verified!
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {gymDistanceMeters != null
                        ? `You are checked in (${gymDistanceMeters}m from pinned coordinates).`
                        : 'You are within your facility radius.'}{' '}
                      Ready for high-intensity training!
                    </p>
                  </div>
                </div>
              )}

              {gymCheckStatus === 'outside' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(234, 179, 8, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={30} color="#eab308" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-1)', color: 'var(--text-primary)', fontWeight: 700 }}>
                      Away from Registered Gym
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      You appear to be {gymDistanceMeters}m away from your gym (target radius: {fitnessProfile?.gymRadiusMeters || 200}m). Training away or at home today?
                    </p>
                  </div>
                </div>
              )}

              {gymCheckStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={28} color="var(--text-muted)" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 var(--space-1)', color: 'var(--text-primary)', fontWeight: 700 }}>
                      GPS Unavailable
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      Could not get current GPS location. You can proceed directly with your workout.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(gymCheckStatus === 'outside' || gymCheckStatus === 'error') && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => performGymVerification(pendingWorkoutDay, pendingWorkoutMode)}
                >
                  Retry GPS
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleConfirmStart}
              >
                {gymCheckStatus === 'verified' ? 'Start Session Now' : 'Proceed to Workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
