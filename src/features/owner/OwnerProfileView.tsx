import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  ShieldCheck,
  QrCode,
  Edit3,
  Save,
  X,
  Clock,
  Phone,
  Mail,
  Sliders,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOwnerGym } from '@/context/OwnerGymContext';
import { Link } from 'react-router-dom';
import { WeeklySchedule } from '@/types/gym.types';

export const OwnerProfileView: React.FC = () => {
  const { session } = useAuth();
  const { activeGym, updateGym, loading } = useOwnerGym();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form edit states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [latitude, setLatitude] = useState('19.0760');
  const [longitude, setLongitude] = useState('72.8777');

  useEffect(() => {
    if (activeGym) {
      setName(activeGym.name || '');
      setSlug(activeGym.slug || '');
      setAddress(activeGym.address || '');
      setCity(activeGym.city || '');
      setState(activeGym.state || '');
      setPincode(activeGym.pincode || '');
      setContactNumber(activeGym.contactNumber || '');
      setEmail(activeGym.email || '');
      setDescription(activeGym.description || '');
      setRadiusMeters(activeGym.radiusMeters || 200);
      setLatitude(activeGym.latitude?.toString() || '19.0760');
      setLongitude(activeGym.longitude?.toString() || '72.8777');
    }
  }, [activeGym]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym) return;

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const res = await updateGym(activeGym.id, {
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        radiusMeters: radiusMeters > 0 ? radiusMeters : 200,
        latitude: parseFloat(latitude) || activeGym.latitude,
        longitude: parseFloat(longitude) || activeGym.longitude,
      });

      if (!res.success) {
        setSaveError(res.error || 'Failed to update gym profile');
        setSaving(false);
        return;
      }

      setSaveSuccess(true);
      setIsEditing(false);
      setSaving(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveError(msg);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading gym profile...</div>
      </div>
    );
  }

  if (!activeGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
        <div className="card card-elevated" style={{ padding: 'var(--space-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <Building2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>No Facility Registered Yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto var(--space-6)' }}>
            Register your gym to configure its geofence perimeter, check-in QR terminal, and operational profile.
          </p>
          <Link to="/owner/onboarding" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={16} />
            <span>Register Facility</span>
          </Link>
        </div>
      </div>
    );
  }

  const createdFormatted = activeGym.createdAt
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(activeGym.createdAt))
    : 'Recently';

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Building2 size={16} />
            <span>FACILITY IDENTITY</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Gym Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Manage your facility information, geofence radius, and contact channels.
          </p>
        </div>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Edit3 size={15} />
            <span>Edit Profile</span>
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(false)}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <X size={15} />
            <span>Cancel</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div
          className="card animate-fade-in"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: 'var(--color-success)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span>Gym profile updated successfully!</span>
        </div>
      )}

      {/* Error Notification */}
      {saveError && (
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
            gap: '8px',
            fontSize: '0.9rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{saveError}</span>
        </div>
      )}

      {isEditing ? (
        /* Edit Mode Form */
        <form onSubmit={handleSave} className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Edit Facility Information</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Facility Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Slug
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Street Address
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                City
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={e => setCity(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Pincode
              </label>
              <input
                type="text"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Contact Number
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Geofence Radius (meters)
              </label>
              <input
                type="number"
                min="50"
                max="1000"
                value={radiusMeters}
                onChange={e => setRadiusMeters(parseInt(e.target.value, 10))}
                className="input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* View Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Main Facility Banner */}
          <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(214, 168, 79, 0.15)',
                  color: 'var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 size={32} />
              </div>

              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeGym.name}</h2>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: 'var(--color-success)',
                    }}
                  >
                    Operational
                  </span>
                  <span className="badge" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Registered: {createdFormatted}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
                  <MapPin size={15} />
                  <span>
                    {activeGym.address}, {activeGym.city}
                    {activeGym.state ? `, ${activeGym.state}` : ''}
                    {activeGym.pincode ? ` - ${activeGym.pincode}` : ''}
                  </span>
                </div>

                {activeGym.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                    {activeGym.description}
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={15} style={{ color: 'var(--accent-primary)' }} />
                    <span>Perimeter: {activeGym.radiusMeters}m</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <QrCode size={15} style={{ color: 'var(--accent-gold)' }} />
                    <span>Slug: <code>{activeGym.slug}</code></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={15} style={{ color: 'var(--color-success)' }} />
                    <span>Owner: {session.profile?.displayName || 'Owner'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Hours Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} style={{ color: 'var(--accent-gold)' }} />
                <span>Contact Channels</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Phone: </span>
                  <span style={{ fontWeight: 600 }}>{activeGym.contactNumber || 'Not specified'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                  <span style={{ fontWeight: 600 }}>{activeGym.email || 'Not specified'}</span>
                </div>
              </div>
            </div>

            <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
                <span>Operating Hours</span>
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {activeGym.weeklySchedule ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(Object.keys(activeGym.weeklySchedule) as Array<keyof WeeklySchedule>).slice(0, 3).map(d => {
                      const sched = activeGym.weeklySchedule![d];
                      const dCap = d.charAt(0).toUpperCase() + d.slice(1);
                      return (
                        <div key={d} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{dCap}:</span>
                          <span>{sched.isOpen ? `${sched.openTime} - ${sched.closeTime}` : 'Closed'}</span>
                        </div>
                      );
                    })}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                      (Full 7-day schedule configured)
                    </div>
                  </div>
                ) : (
                  <div>
                    {activeGym.openingTime || '06:00'} - {activeGym.closingTime || '22:00'} (Daily)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
