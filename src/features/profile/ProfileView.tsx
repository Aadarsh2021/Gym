import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Shield,
  Dumbbell,
  Save,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Bell,
  Clock,
  Info,
  MapPin,
  Navigation,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { profileService } from '@/services/profile.service';
import { nutritionService } from '@/services/nutrition.service';
import {
  reminderService,
  NotificationPermissionStatus,
  AlarmMotivationStyle,
  MOTIVATION_TEMPLATES,
} from '@/services/reminder.service';
import { ExperienceLevel, FitnessGoal, Gender } from '@/types/user.types';
import { calculateBMR, calculateTDEE, calculateCalorieTarget } from '@/domain/calories';
import { calculateProteinTarget, calculateMacroSplit } from '@/domain/protein';
import { validateBiometrics } from '@/utils/validation';

export const ProfileView: React.FC = () => {
  const { session, signOut } = useAuth();
  const { isPremium } = useEntitlement();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields
  const [weightKg, setWeightKg] = useState<number>(70);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<Gender>('male');
  const [goal, setGoal] = useState<FitnessGoal>('muscle_gain');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [equipment, setEquipment] = useState<string[]>(['Barbell', 'Dumbbells', 'Bodyweight']);
  const [limitations, setLimitations] = useState<string[]>(['None']);

  // Gym Location Verification State
  const [gymLatitude, setGymLatitude] = useState<number | null>(null);
  const [gymLongitude, setGymLongitude] = useState<number | null>(null);
  const [gymRadiusMeters, setGymRadiusMeters] = useState<number>(200);
  const [capturingLocation, setCapturingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);

  // Workout Alarm & Reminder state
  const [reminderId, setReminderId] = useState<string | undefined>(undefined);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>('07:30');
  const [reminderDays, setReminderDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [motivationStyle, setMotivationStyle] = useState<AlarmMotivationStyle>('basic');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('default');
  const [testNoticeMsg, setTestNoticeMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [snoozeNoticeMsg, setSnoozeNoticeMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const [profile, reminderPref] = await Promise.all([
          profileService.getFitnessProfile(userId),
          reminderService.getReminderPreference(userId),
        ]);

        if (isMounted && profile) {
          setWeightKg(profile.weightKg || 70);
          setHeightCm(profile.heightCm || 175);
          setAge(profile.age || 25);
          setGender(profile.gender || 'male');
          setGoal(profile.goal || 'muscle_gain');
          setExperienceLevel(profile.experienceLevel || 'intermediate');
          setDaysPerWeek(profile.daysPerWeek || 4);
          if (profile.equipment && profile.equipment.length > 0) {
            setEquipment(profile.equipment);
          }
          if (profile.limitations && profile.limitations.length > 0) {
            setLimitations(profile.limitations);
          }
          if (profile.gymLatitude) setGymLatitude(profile.gymLatitude);
          if (profile.gymLongitude) setGymLongitude(profile.gymLongitude);
          if (profile.gymRadiusMeters) setGymRadiusMeters(profile.gymRadiusMeters);
        }

        if (isMounted && reminderPref) {
          setReminderId(reminderPref.id);
          setReminderEnabled(reminderPref.enabled);
          setReminderTime(reminderPref.time);
          setReminderDays(reminderPref.days);
          setMotivationStyle(reminderPref.motivationStyle || 'basic');
          setPermissionStatus(reminderService.getPermissionStatus());
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleCaptureCurrentLocation = () => {
    setLocationError(null);
    setLocationSuccess(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setGymLatitude(lat);
        setGymLongitude(lng);
        setCapturingLocation(false);
        setLocationSuccess(`Gym coordinates pinned: ${lat}, ${lng}. Click Save Profile Changes below to persist.`);
      },
      err => {
        setCapturingLocation(false);
        setLocationError(`Location request failed: ${err.message}. Please allow location access in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearGymLocation = () => {
    setGymLatitude(null);
    setGymLongitude(null);
    setLocationSuccess('Gym location cleared. Click Save Profile Changes to persist.');
  };

  const toggleLimitation = (item: string) => {
    if (item === 'None') {
      setLimitations(['None']);
      return;
    }
    let updated = limitations.filter(l => l !== 'None');
    if (updated.includes(item)) {
      updated = updated.filter(l => l !== item);
    } else {
      updated.push(item);
    }
    setLimitations(updated.length === 0 ? ['None'] : updated);
  };

  const toggleEquipment = (item: string) => {
    if (equipment.includes(item)) {
      if (equipment.length > 1) {
        setEquipment(equipment.filter(e => e !== item));
      }
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const toggleReminderDay = (dayNum: number) => {
    if (reminderDays.includes(dayNum)) {
      if (reminderDays.length > 1) {
        setReminderDays(reminderDays.filter(d => d !== dayNum));
      }
    } else {
      setReminderDays([...reminderDays, dayNum].sort((a, b) => a - b));
    }
  };

  const handleRequestPermission = async () => {
    const res = await reminderService.requestPermission();
    setPermissionStatus(res);
  };

  const handleSendTestNotification = async () => {
    setTestNoticeMsg(null);
    const res = await reminderService.sendTestNotification();
    setTestNoticeMsg({ success: res.success, text: res.message });
    setPermissionStatus(reminderService.getPermissionStatus());
  };

  const handleSnooze = (minutes = 10) => {
    const res = reminderService.snooze(
      {
        id: reminderId,
        userId,
        enabled: true,
        time: reminderTime,
        days: reminderDays,
        title: 'Time for Today’s Workout Session',
        message: 'Your scheduled training session is waiting. Maintain your streak today!',
      },
      minutes
    );
    const date = new Date(res.snoozedUntil);
    setSnoozeNoticeMsg(
      `Alarm snoozed for ${minutes} minutes (fires at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateBiometrics({ age, heightCm, weightKg });
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Please enter valid biometrics');
      return;
    }

    setSaving(true);
    try {
      // 1. Update fitness profile
      await profileService.saveFitnessProfile({
        userId,
        age,
        heightCm,
        weightKg,
        gender,
        goal,
        experienceLevel,
        daysPerWeek,
        workoutDurationMinutes: 60,
        equipment,
        dietaryPreference: 'vegetarian',
        limitations,
        gymLatitude,
        gymLongitude,
        gymRadiusMeters,
      });

      // 2. Synchronize calculated nutrition profile
      const bmr = calculateBMR({ weightKg, heightCm, age, gender });
      const tdee = calculateTDEE(bmr, daysPerWeek);
      const targetCalories = calculateCalorieTarget(tdee, goal);
      const targetProteinG = calculateProteinTarget(weightKg, goal);
      const macros = calculateMacroSplit(targetCalories, targetProteinG);

      await nutritionService.saveNutritionProfile({
        userId,
        bmrCalories: bmr,
        tdeeCalories: tdee,
        targetCalories,
        targetProteinG,
        targetCarbsG: macros.carbsG,
        targetFatG: macros.fatG,
        calculationVersion: 'v1.0-deterministic',
      });

      // 3. Persist workout reminder preferences
      const styleTemplate = MOTIVATION_TEMPLATES[motivationStyle] || MOTIVATION_TEMPLATES.basic;
      const reminderRes = await reminderService.saveReminderPreference({
        id: reminderId,
        userId,
        enabled: reminderEnabled,
        time: reminderTime,
        days: reminderDays,
        title: styleTemplate.title,
        message: styleTemplate.message,
        motivationStyle,
      });

      if (!reminderRes.success && reminderRes.error) {
        setErrorMsg(reminderRes.error);
        setSaving(false);
        return;
      }

      setSuccessMsg('Profile, nutrition baselines, and workout alarms saved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading account profile...</p>
      </div>
    );
  }

  const nextAlarmMs = reminderEnabled
    ? reminderService.getMillisecondsUntilNextReminder(reminderTime, reminderDays)
    : null;
  const timeUntilAlarm = reminderService.formatTimeRemaining(nextAlarmMs);

  return (
    <div className="container-narrow animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4) calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-8))' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-1)' }}>Athlete Account</span>
        <h1>Profile & Preferences</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your biometric baselines, training goals, and equipment settings.
        </p>
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--accent-success)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-success)',
            fontSize: '0.9rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(255, 77, 77, 0.15)',
            border: '1px solid var(--accent-fire)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-fire)',
            fontSize: '0.9rem',
            marginBottom: 'var(--space-4)',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Account Info Card */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>{session.user?.email || 'Guest User'}</h3>
              <small style={{ color: 'var(--text-muted)' }}>Supabase Authenticated Account</small>
            </div>
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Biometrics & Preferences Form */}
      <form onSubmit={handleSaveProfile} className="card card-elevated" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Shield size={20} color="var(--accent-primary)" /> Biometrics & Metabolism
        </h3>

        <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div className="input-group">
            <label className="label">Current Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={weightKg}
              onChange={e => setWeightKg(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Height (cm)</label>
            <input
              type="number"
              className="input"
              value={heightCm}
              onChange={e => setHeightCm(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Age</label>
            <input
              type="number"
              className="input"
              value={age}
              onChange={e => setAge(parseInt(e.target.value) || 0)}
              required
            />
          </div>
          <div className="input-group">
            <label className="label">Biological Sex</label>
            <select className="select" value={gender} onChange={e => setGender(e.target.value as Gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Dumbbell size={20} color="var(--accent-primary)" /> Training Preferences
        </h3>

        <div className="grid grid-cols-2" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div className="input-group">
            <label className="label">Primary Goal</label>
            <select className="select" value={goal} onChange={e => setGoal(e.target.value as FitnessGoal)}>
              <option value="muscle_gain">Hypertrophy (Muscle Gain)</option>
              <option value="strength">Pure Strength</option>
              <option value="fat_loss">Fat Loss</option>
              <option value="endurance">Endurance & Conditioning</option>
            </select>
          </div>
          <div className="input-group">
            <label className="label">Experience Level</label>
            <select className="select" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value as ExperienceLevel)}>
              <option value="beginner">Beginner (&lt; 1 yr)</option>
              <option value="intermediate">Intermediate (1-3 yrs)</option>
              <option value="advanced">Advanced (3+ yrs)</option>
            </select>
          </div>
        </div>

        {/* Equipment Selector */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label">Available Equipment</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {['Barbell', 'Dumbbells', 'Cable', 'Bodyweight', 'Machines'].map(item => {
              const active = equipment.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`badge ${active ? 'badge-accent' : 'badge-secondary'}`}
                  style={{ padding: '6px 12px', cursor: 'pointer', border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)' }}
                >
                  {item} {active ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Physical Limitations & Movement Focus */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label">Physical Limitations & Movement Focus</label>

          <div
            style={{
              padding: 'var(--space-3)',
              background: 'rgba(59, 75, 107, 0.18)',
              border: '1px solid var(--accent-indigo)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-3)',
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'flex-start',
            }}
          >
            <ShieldAlert size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Non-Medical Disclaimer: </strong>
              Movement adjustments are general biomechanical exercise modifications based on joint stress distribution, NOT medical diagnosis or physical therapy. Consult a physician for injuries.
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {['None', 'Lower Back', 'Knees', 'Shoulders', 'Elbows', 'Wrists', 'Hips', 'Ankles'].map(lim => {
              const active = limitations.includes(lim);
              return (
                <button
                  key={lim}
                  type="button"
                  onClick={() => toggleLimitation(lim)}
                  className={`badge ${active ? 'badge-accent' : 'badge-secondary'}`}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                  }}
                >
                  {lim} {active ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workout Alarms & Scheduled Reminders Card */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Bell size={20} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Workout Alarm & Scheduled Reminders</h3>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={e => setReminderEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
              />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: reminderEnabled ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {reminderEnabled ? 'Alarm Active' : 'Alarm Disabled'}
              </span>
            </label>
          </div>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.88rem',
              margin: '0 0 var(--space-4)',
              lineHeight: 1.5,
            }}
          >
            Schedule session alerts and smart repeat reminders to maintain your training discipline and daily streak.
          </p>

          {/* Alarm Time & Live Countdown Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Alarm Time (24-Hour)
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                disabled={!reminderEnabled}
                className="input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Next Scheduled Session
              </label>
              <div
                style={{
                  padding: '9px 12px',
                  background: 'var(--color-surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  color: reminderEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '42px',
                }}
              >
                <Clock size={15} />
                <span>{reminderEnabled ? `Fires in ${timeUntilAlarm}` : 'Alarms paused'}</span>
              </div>
            </div>
          </div>

          {/* Smart Repeat: Day Chips */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                marginBottom: 'var(--space-2)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Smart Repeat Days
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {[
                { day: 1, label: 'Mon' },
                { day: 2, label: 'Tue' },
                { day: 3, label: 'Wed' },
                { day: 4, label: 'Thu' },
                { day: 5, label: 'Fri' },
                { day: 6, label: 'Sat' },
                { day: 7, label: 'Sun' },
              ].map(({ day, label }) => {
                const active = reminderDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!reminderEnabled}
                    onClick={() => toggleReminderDay(day)}
                    className={`badge ${active && reminderEnabled ? 'badge-accent' : 'badge-secondary'}`}
                    style={{
                      padding: '6px 14px',
                      cursor: reminderEnabled ? 'pointer' : 'not-allowed',
                      opacity: reminderEnabled ? 1 : 0.6,
                      border:
                        active && reminderEnabled
                          ? '1px solid var(--accent-primary)'
                          : '1px solid var(--border-medium)',
                      fontWeight: 600,
                    }}
                  >
                    {label} {active ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motivation Style & Tone Customization (Premium V1) */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                Motivation Style & Alarm Tone
              </label>
              <span className="badge badge-secondary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {!isPremium && <Lock size={10} />} PREMIUM V1 CUSTOMIZATION
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-2)' }}>
              {(Object.keys(MOTIVATION_TEMPLATES) as AlarmMotivationStyle[]).map(styleKey => {
                const item = MOTIVATION_TEMPLATES[styleKey];
                const isSelected = motivationStyle === styleKey;
                const isLocked = item.isPremium && !isPremium;

                return (
                  <div
                    key={styleKey}
                    onClick={() => {
                      if (!isLocked) {
                        setMotivationStyle(styleKey);
                      }
                    }}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--color-surface-subtle)' : 'var(--bg-surface)',
                      border: isSelected
                        ? '1.5px solid var(--accent-primary)'
                        : '1px solid var(--border-subtle)',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.65 : 1,
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.86rem' }}>{item.label}</strong>
                      {isLocked && <Lock size={12} color="#eab308" />}
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Browser Permission Status & Action Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-4)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Browser Alerts:</span>
              {permissionStatus === 'granted' && (
                <span
                  className="badge badge-success"
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(127, 166, 107, 0.15)',
                    color: 'var(--color-success)',
                    border: '1px solid var(--color-success)',
                  }}
                >
                  ✓ Allowed
                </span>
              )}
              {permissionStatus === 'denied' && (
                <span
                  className="badge"
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(193, 89, 79, 0.15)',
                    color: 'var(--color-error)',
                    border: '1px solid var(--color-error)',
                  }}
                >
                  ✕ Blocked
                </span>
              )}
              {permissionStatus === 'default' && (
                <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                  Permission Needed
                </span>
              )}
              {permissionStatus === 'unsupported' && (
                <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                  Not Supported
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleRequestPermission}
                >
                  Allow Notifications
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSendTestNotification}
                title="Trigger immediate test alarm"
              >
                Send Test Alert
              </button>
              {reminderEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '2px' }}>Snooze:</span>
                  {[5, 10, 15].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.78rem' }}
                      onClick={() => handleSnooze(mins)}
                      title={`Snooze reminder by ${mins} minutes`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Test & Snooze Feedback alerts */}
          {testNoticeMsg && (
            <div
              style={{
                fontSize: '0.82rem',
                color: testNoticeMsg.success ? 'var(--color-success)' : '#EF4444',
                marginBottom: 'var(--space-3)',
                padding: '6px 10px',
                background: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {testNoticeMsg.text}
            </div>
          )}
          {snoozeNoticeMsg && (
            <div
              style={{
                fontSize: '0.82rem',
                color: 'var(--accent-primary)',
                marginBottom: 'var(--space-3)',
                padding: '6px 10px',
                background: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {snoozeNoticeMsg}
            </div>
          )}

          {/* Mandatory Transparent Session Notification Disclosure */}
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'rgba(59, 75, 107, 0.15)',
              border: '1px solid var(--accent-indigo)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'flex-start',
            }}
          >
            <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Session Notification Notice: </strong>
              Workout reminders trigger reliably while your application or browser tab is active. Operating system background push across sleeping devices requires native OS push infrastructure. Your workout tracking, PR records, and streak scores never depend on reminders.
            </span>
          </div>
        </div>

        {/* Gym Facility Location Verification Card */}
        <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <MapPin size={20} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Gym Location Verification</h3>
            </div>
            <span
              className={`badge ${gymLatitude && gymLongitude ? 'badge-success' : ''}`}
              style={{ fontSize: '0.72rem' }}
            >
              {gymLatitude && gymLongitude ? 'Location Pinned' : 'Not Configured'}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
            Optionally save the GPS coordinates of your gym or home training center. FitBoost uses this for soft proximity check-ins when starting a session.
          </p>

          {locationSuccess && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-muted)', color: 'var(--color-success)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.84rem' }}>
              {locationSuccess}
            </div>
          )}

          {locationError && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-muted)', color: 'var(--color-error)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.84rem' }}>
              {locationError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Saved Coordinates
              </span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-mono)', color: gymLatitude ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {gymLatitude && gymLongitude ? `${gymLatitude.toFixed(4)}°N, ${gymLongitude.toFixed(4)}°E` : 'No location saved'}
              </span>
            </div>

            <div>
              <label className="label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Verification Radius
              </label>
              <select
                className="select select-sm"
                value={gymRadiusMeters}
                onChange={e => setGymRadiusMeters(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={50}>50 meters (Compact Gym)</option>
                <option value={100}>100 meters (Standard Facility)</option>
                <option value={200}>200 meters (Fitness Compound - Recommended)</option>
                <option value={500}>500 meters (Sports Complex / Campus)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCaptureCurrentLocation}
              disabled={capturingLocation}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Navigation size={14} />
              {capturingLocation ? 'Acquiring GPS...' : 'Pin Current GPS Location as Gym'}
            </button>

            {gymLatitude && gymLongitude && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleClearGymLocation}
                style={{ color: 'var(--text-muted)' }}
              >
                Clear Pinned Gym
              </button>
            )}
          </div>
        </div>

        {/* Save button */}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </form>

      {/* Link to Rebuild Plan */}
      <div className="card" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h4 style={{ fontSize: '1.05rem' }}>Want to change your workout split?</h4>
          <small style={{ color: 'var(--text-muted)' }}>Generate and preview a new training schedule</small>
        </div>
        <Link to="/plan/build" className="btn btn-outline btn-sm">
          Rebuild Training Plan →
        </Link>
      </div>
    </div>
  );
};
