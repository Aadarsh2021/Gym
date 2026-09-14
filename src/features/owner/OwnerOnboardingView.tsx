import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Clock,
  Image as ImageIcon,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Navigation,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOwnerGym, CreateGymInput } from '@/context/OwnerGymContext';
import { platform } from '@/platform';
import { WeeklySchedule } from '@/types/gym.types';

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
  tuesday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
  wednesday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
  thursday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
  friday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
  saturday: { isOpen: true, openTime: '07:00', closeTime: '21:00' },
  sunday: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
};

const STEPS = [
  { id: 1, label: 'Basic Info', icon: Building2 },
  { id: 2, label: 'Location & Perimeter', icon: MapPin },
  { id: 3, label: 'Operating Schedule', icon: Clock },
  { id: 4, label: 'Contact & Profile', icon: ImageIcon },
  { id: 5, label: 'Review & Register', icon: CheckCircle2 },
];

export const OwnerOnboardingView: React.FC = () => {
  const { session } = useAuth();
  const { createGym } = useOwnerGym();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  const [latitude, setLatitude] = useState<string>('19.0760');
  const [longitude, setLongitude] = useState<string>('72.8777');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE);

  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Step 1 Validation
  const isStep1Valid = name.trim().length > 0 && city.trim().length > 0 && address.trim().length > 0;

  // Slug auto-generator hint
  const generatedSlugHint = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const handleUseCurrentLocation = async () => {
    if (!platform.location.isSupported()) {
      setLocError('Geolocation is not supported by your current platform');
      return;
    }

    try {
      setLocating(true);
      setLocError(null);
      const coords = await platform.location.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      setLatitude(coords.latitude.toFixed(6));
      setLongitude(coords.longitude.toFixed(6));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire GPS coordinates';
      setLocError(msg);
    } finally {
      setLocating(false);
    }
  };

  const handleScheduleToggle = (day: keyof WeeklySchedule) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen,
      },
    }));
  };

  const handleScheduleTimeChange = (
    day: keyof WeeklySchedule,
    field: 'openTime' | 'closeTime',
    val: string
  ) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val,
      },
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isStep1Valid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const latNum = parseFloat(latitude) || 19.0760;
      const lngNum = parseFloat(longitude) || 72.8777;

      const payload: CreateGymInput = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        openingTime: weeklySchedule.monday.openTime,
        closingTime: weeklySchedule.monday.closeTime,
        weeklySchedule,
        latitude: latNum,
        longitude: lngNum,
        radiusMeters: radiusMeters > 0 ? radiusMeters : 200,
        logoUrl: logoUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      };

      const result = await createGym(payload);

      if (!result.success) {
        setSubmitError(result.error || 'Failed to create gym');
        setIsSubmitting(false);
        return;
      }

      // Success -> navigate to owner console
      navigate('/owner/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error creating facility';
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="container animate-fade-in"
      style={{
        maxWidth: '840px',
        padding: 'var(--space-8) var(--space-4)',
        minHeight: '85vh',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(214, 168, 79, 0.12)',
            color: 'var(--accent-gold)',
            border: '1px solid rgba(214, 168, 79, 0.25)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8rem',
            fontWeight: 700,
            marginBottom: 'var(--space-3)',
          }}
        >
          <Building2 size={15} />
          <span>FACILITY REGISTRATION ONBOARDING</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>
          Register Your Gym
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '540px', margin: '0 auto' }}>
          Welcome, {session.profile?.displayName || 'Owner'}! Let's set up your facility profile, check-in radius, and operational hours.
        </p>
      </div>

      {/* Multi-Step Stepper Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-8)',
          background: 'var(--bg-surface)',
          padding: 'var(--space-4) var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          overflowX: 'auto',
          gap: 'var(--space-2)',
        }}
      >
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => {
                  if (isDone || (step.id === 2 && isStep1Valid)) {
                    setCurrentStep(step.id);
                  }
                }}
                disabled={step.id > 1 && !isStep1Valid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: isDone || (step.id === 2 && isStep1Valid) ? 'pointer' : 'default',
                  opacity: step.id > currentStep && (!isStep1Valid || step.id > 2) ? 0.45 : 1,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--accent-gold)' : isDone ? 'var(--color-success)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive
                      ? 'rgba(214, 168, 79, 0.2)'
                      : isDone
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'var(--bg-surface-elevated)',
                    border: `1px solid ${
                      isActive
                        ? 'var(--accent-gold)'
                        : isDone
                        ? 'var(--color-success)'
                        : 'var(--border-subtle)'
                    }`,
                  }}
                >
                  {isDone ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                </div>
                <span>{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: currentStep > step.id ? 'var(--color-success)' : 'var(--border-subtle)',
                    minWidth: '20px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Submission Error Banner */}
      {submitError && (
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
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Step Card */}
      <div
        className="card card-elevated"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* ==================================================================
            STEP 1: Basic Gym Information
            ================================================================== */}
        {currentStep === 1 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
              Step 1: Facility Basics
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-6)' }}>
              Enter your gym's official name, street address, and city.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Gym Name <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Iron Pulse Fitness Club"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Custom Slug (Optional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>fitboost.app/gym/</span>
                  <input
                    type="text"
                    placeholder={generatedSlugHint || 'iron-pulse'}
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Unique URL handle. If left empty, it will be automatically derived from the gym name.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Street Address <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Plot 42, Bandra West Link Road"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    City <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    State / Province
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Pincode / Postal Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 400050"
                    value={pincode}
                    onChange={e => setPincode(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            STEP 2: Location & Geofencing
            ================================================================== */}
        {currentStep === 2 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
              Step 2: Location & Geofencing Perimeter
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-6)' }}>
              GPS coordinates allow members to verify their presence when checking in.
            </p>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Navigation size={16} />
                <span>{locating ? 'Acquiring GPS...' : 'Use Current Device Location'}</span>
              </button>
              {locError && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '6px' }}>
                  {locError}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="19.076000"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  placeholder="72.877700"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Check-in Geofence Radius
                </label>
                <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>
                  {radiusMeters} meters
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                value={radiusMeters}
                onChange={e => setRadiusMeters(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Athletes within this radius can check into the gym via GPS. Recommended default: 200m.
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            STEP 3: Operating Schedule
            ================================================================== */}
        {currentStep === 3 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
              Step 3: Operating Schedule
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-6)' }}>
              Set opening and closing hours for each day of the week.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {(Object.keys(weeklySchedule) as Array<keyof WeeklySchedule>).map(day => {
                const sched = weeklySchedule[day];
                const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
                return (
                  <div
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '130px' }}>
                      <input
                        type="checkbox"
                        checked={sched.isOpen}
                        onChange={() => handleScheduleToggle(day)}
                        id={`check-${day}`}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }}
                      />
                      <label htmlFor={`check-${day}`} style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                        {dayCap}
                      </label>
                    </div>

                    {sched.isOpen ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="time"
                          value={sched.openTime}
                          onChange={e => handleScheduleTimeChange(day, 'openTime', e.target.value)}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input
                          type="time"
                          value={sched.closeTime}
                          onChange={e => handleScheduleTimeChange(day, 'closeTime', e.target.value)}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      </div>
                    ) : (
                      <span className="badge" style={{ color: 'var(--text-muted)' }}>
                        Closed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================
            STEP 4: Contact & Branding
            ================================================================== */}
        {currentStep === 4 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
              Step 4: Contact Details & Profile
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-6)' }}>
              Provide contact info and optional branding images for athlete discovery.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Facility Contact Phone
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={contactNumber}
                      onChange={e => setContactNumber(e.target.value)}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Facility Email
                  </label>
                  <input
                    type="email"
                    placeholder="contact@ironpulse.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Facility Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell athletes about equipment, amenities, personal trainers, and community vibe..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Gym Logo URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  value={coverImageUrl}
                  onChange={e => setCoverImageUrl(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================
            STEP 5: Review & Register
            ================================================================== */}
        {currentStep === 5 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
              Step 5: Review Facility Profile
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 'var(--space-6)' }}>
              Confirm your facility information before generating your gym identity and check-in terminal.
            </p>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(214, 168, 79, 0.2)',
                    color: 'var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{name}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {city}{state ? `, ${state}` : ''} • Slug: <code>{slug || generatedSlugHint}</code>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Address</span>
                  <span style={{ fontWeight: 600 }}>{address}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Geofence Radius</span>
                  <span style={{ fontWeight: 600 }}>{radiusMeters}m perimeter</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Coordinates</span>
                  <span style={{ fontWeight: 600 }}>{latitude}, {longitude}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Contact Phone</span>
                  <span style={{ fontWeight: 600 }}>{contactNumber || 'Not provided'}</span>
                </div>
              </div>

              {description && (
                <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stepper Navigation Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'var(--space-8)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <Link to="/owner/dashboard" className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </Link>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
              disabled={!isStep1Valid}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !isStep1Valid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #D6A84F 0%, #B8860B 100%)',
                color: '#000000',
                fontWeight: 700,
              }}
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? 'Creating Facility...' : 'Register Facility'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
