import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  MapPin,
  Clock,
  Sliders,
  Send,
  CheckCircle2,
  ExternalLink,
  X,
  Sparkles,
  UserCheck,
  Hourglass,
  Snowflake,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { gymRepository } from '@/repositories/gym.repository';
import { Gym, GymMembership, GymMembershipStatus } from '@/types/gym.types';
import { useAuth } from '@/hooks/useAuth';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { logger } from '@/lib/logger';

export const MemberGymDiscoveryView: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    memberGymCtx = useMemberGymContext();
  } catch {
    // Safe fallback if rendered without provider in standalone tests
  }

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);

  // User memberships map: gymId -> status
  const [userMembershipsMap, setUserMembershipsMap] = useState<Record<string, GymMembershipStatus>>({});

  // Modal membership state
  const [modalMembership, setModalMembership] = useState<GymMembership | null>(null);
  const [loadingMembership, setLoadingMembership] = useState<boolean>(false);
  const [requestingMembership, setRequestingMembership] = useState<boolean>(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [membershipSuccessMsg, setMembershipSuccessMsg] = useState<string | null>(null);

  // Invite Gym Form State
  const [inviteGymName, setInviteGymName] = useState<string>('');
  const [inviteCity, setInviteCity] = useState<string>('');
  const [inviteSubmitted, setInviteSubmitted] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const loadGyms = async () => {
      try {
        setLoading(true);
        const all = await gymRepository.fetchAllGyms();
        if (mounted) {
          setGyms(all);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    loadGyms();

    if (userId) {
      gymRepository
        .getMyGymMemberships(userId)
        .then(list => {
          if (mounted) {
            const map: Record<string, GymMembershipStatus> = {};
            list.forEach(m => {
              map[m.gymId] = m.status;
            });
            setUserMembershipsMap(map);
          }
        })
        .catch(err => {
          logger.error('Error loading user memberships map', { err });
        });
    }

    return () => {
      mounted = false;
    };
  }, [userId]);

  // Load membership details when a gym modal is opened
  useEffect(() => {
    if (!selectedGym || !userId) {
      setModalMembership(null);
      setMembershipError(null);
      setMembershipSuccessMsg(null);
      return;
    }
    let isMounted = true;
    setLoadingMembership(true);
    setMembershipError(null);
    setMembershipSuccessMsg(null);

    gymRepository
      .getMyGymMembership(selectedGym.id, userId)
      .then(m => {
        if (isMounted) setModalMembership(m);
      })
      .catch(err => {
        if (isMounted) logger.error('Error fetching modal membership', { err });
      })
      .finally(() => {
        if (isMounted) setLoadingMembership(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGym, userId]);

  const handleJoinGym = async () => {
    if (!selectedGym || !userId || requestingMembership) return;
    setRequestingMembership(true);
    setMembershipError(null);
    setMembershipSuccessMsg(null);

    try {
      const res = await gymRepository.requestGymMembership(selectedGym.id, userId, 'monthly');
      if (res.success && res.membership) {
        setModalMembership(res.membership);
        setMembershipSuccessMsg(
          res.membership.status === 'active'
            ? 'Your membership is active!'
            : 'Membership request submitted successfully! Awaiting gym confirmation.'
        );
        setUserMembershipsMap(prev => ({
          ...prev,
          [selectedGym.id]: res.membership!.status,
        }));
        if (memberGymCtx?.refreshContext) {
          memberGymCtx.refreshContext().catch(() => {});
        }
      } else {
        setMembershipError(res.error || 'Failed to request membership.');
        if (res.membership) {
          setModalMembership(res.membership);
          setUserMembershipsMap(prev => ({
            ...prev,
            [selectedGym.id]: res.membership!.status,
          }));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while requesting membership.';
      setMembershipError(msg);
    } finally {
      setRequestingMembership(false);
    }
  };

  // Unique cities list for filtering
  const cities = useMemo(() => {
    const set = new Set<string>();
    gyms.forEach(g => {
      if (g.city) set.add(g.city);
    });
    return Array.from(set).sort();
  }, [gyms]);

  // Filtered gyms
  const filteredGyms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return gyms.filter(g => {
      const matchSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        g.address.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q));

      const matchCity = selectedCity === 'all' || g.city.toLowerCase() === selectedCity.toLowerCase();
      return matchSearch && matchCity;
    });
  }, [gyms, searchQuery, selectedCity]);

  const handleNominateGym = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteGymName.trim()) return;
    setInviteSubmitted(true);
    setInviteGymName('');
    setInviteCity('');
    setTimeout(() => setInviteSubmitted(false), 5000);
  };

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)', maxWidth: '1200px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
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
          <Building2 size={14} />
          <span>GYM INTEGRATION & DIRECTORY</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 'var(--space-2)' }}>
          Find Your Gym
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '640px', marginBottom: 'var(--space-4)' }}>
          Connect your account to a FitBoost-integrated training center to unlock digital QR attendance, verified gym workouts, and facility access.
        </p>

        {/* Integrated Gym Status & Quick Check-In CTA */}
        {memberGymCtx?.mode === 'integrated' && memberGymCtx.activeGym && (
          <div
            className="card card-elevated"
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
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
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>{memberGymCtx.activeGym.name}</span>
                  <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.18)', color: 'var(--color-success)', fontSize: '0.72rem' }}>
                    Active Integrated Gym
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {memberGymCtx.activeGym.address}, {memberGymCtx.activeGym.city}
                </div>
              </div>
            </div>

            <Link
              to="/app/gym/check-in"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <QrCode size={15} />
              <span>Scan QR to Check In</span>
            </Link>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div
        className="card card-elevated"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-8)',
          display: 'flex',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search
            size={18}
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
            placeholder="Search gyms by name, location, or slug..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input"
            style={{ width: '100%', paddingLeft: '38px' }}
          />
        </div>

        {cities.length > 0 && (
          <div style={{ minWidth: '160px' }}>
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="input"
              style={{ width: '100%' }}
              aria-label="Filter by city"
            >
              <option value="all">All Cities ({cities.length})</option>
              {cities.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Gym Listings Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12) 0', color: 'var(--text-muted)' }}>
          Loading training facilities...
        </div>
      ) : filteredGyms.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-10)',
          }}
        >
          {filteredGyms.map(gym => (
            <div
              key={gym.id}
              className="card card-elevated"
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                padding: 'var(--space-6)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 180ms ease, border-color 180ms ease',
              }}
            >
              <div>
                {/* Header with Verified Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(79, 140, 255, 0.12)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                        {gym.name}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <code>/{gym.slug}</code>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.68rem',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: 'var(--color-success)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      On FitBoost
                    </span>
                    {userMembershipsMap[gym.id] === 'active' && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(34, 197, 94, 0.22)',
                          color: 'var(--color-success)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✓ Member
                      </span>
                    )}
                    {userMembershipsMap[gym.id] === 'pending' && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(234, 179, 8, 0.22)',
                          color: 'var(--color-warning)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ⏳ Pending
                      </span>
                    )}
                    {userMembershipsMap[gym.id] === 'frozen' && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ❄ Frozen
                      </span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  <MapPin size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {gym.address}, {gym.city}
                  </span>
                </div>

                {/* Description snippet if any */}
                {gym.description && (
                  <p
                    style={{
                      fontSize: '0.83rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                      marginBottom: 'var(--space-4)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {gym.description}
                  </p>
                )}

                {/* Badges / Hours */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', fontSize: '0.75rem', marginBottom: 'var(--space-4)' }}>
                  <div className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>{gym.openingTime || '06:00'} - {gym.closingTime || '22:00'}</span>
                  </div>
                  <div className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sliders size={12} />
                    <span>{gym.radiusMeters}m Geofence</span>
                  </div>
                </div>
              </div>

              {/* View Facility Button */}
              <button
                type="button"
                onClick={() => setSelectedGym(gym)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center', gap: '6px', marginTop: 'var(--space-2)' }}
              >
                <span>View Facility Details</span>
                <ExternalLink size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty Search Results Banner */
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-10)',
          }}
        >
          <Building2 size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            No Gyms Found Matching Your Search
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto var(--space-4)' }}>
            We couldn't find any integrated gyms matching "{searchQuery}". Check your spelling or see if your gym is listed below.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCity('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* "Your Gym Isn't on FitBoost Yet?" Invitation Section */}
      <div
        className="card card-elevated"
        style={{
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: 'var(--space-8)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            <Sparkles size={14} />
            <span>GYM EXPANSION</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
            Your Gym Isn't On FitBoost Yet?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-5)' }}>
            Nominate your local training center or club! We'll reach out to the management and help them configure digital QR check-in terminals, verified visits, and athlete rewards for free.
          </p>

          {inviteSubmitted ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-success)',
                background: 'rgba(34, 197, 94, 0.12)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={18} />
              <span>Thank you! We've noted your gym nomination.</span>
            </div>
          ) : (
            <form
              onSubmit={handleNominateGym}
              style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="Gym Name (e.g. Gold's Gym South Ex)"
                value={inviteGymName}
                onChange={e => setInviteGymName(e.target.value)}
                required
                className="input"
                style={{ flex: 1, minWidth: '220px' }}
              />
              <input
                type="text"
                placeholder="City"
                value={inviteCity}
                onChange={e => setInviteCity(e.target.value)}
                className="input"
                style={{ width: '140px' }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={15} />
                <span>Nominate Gym</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Facility Inspection Modal */}
      {selectedGym && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 'var(--space-4)',
          }}
          onClick={() => setSelectedGym(null)}
        >
          <div
            className="card card-elevated animate-fade-in"
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: 'var(--space-6)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedGym(null)}
              className="btn btn-ghost btn-sm"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '4px',
                minWidth: '32px',
                height: '32px',
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Gym Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(79, 140, 255, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{selectedGym.name}</h3>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--color-success)',
                    marginTop: '2px',
                  }}
                >
                  FitBoost Partner Facility
                </span>
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              <MapPin size={16} style={{ color: 'var(--accent-primary)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div>{selectedGym.address}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {selectedGym.city}{selectedGym.state ? `, ${selectedGym.state}` : ''}
                  {selectedGym.pincode ? ` - ${selectedGym.pincode}` : ''}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedGym.description && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                {selectedGym.description}
              </p>
            )}

            {/* Operational Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Operating Hours</span>
                <span style={{ fontWeight: 600 }}>{selectedGym.openingTime || '06:00'} - {selectedGym.closingTime || '22:00'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Geofence Perimeter</span>
                <span style={{ fontWeight: 600 }}>{selectedGym.radiusMeters}m radius</span>
              </div>
              {selectedGym.contactNumber && (
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Contact</span>
                  <span style={{ fontWeight: 600 }}>{selectedGym.contactNumber}</span>
                </div>
              )}
              {selectedGym.email && (
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Email</span>
                  <span style={{ fontWeight: 600 }}>{selectedGym.email}</span>
                </div>
              )}
            </div>

            {/* Membership Status & Join Flow */}
            <div
              style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} style={{ color: 'var(--accent-primary)' }} />
                  Membership Status
                </span>

                {loadingMembership ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={12} className="animate-spin" /> Verifying...
                  </span>
                ) : modalMembership?.status === 'active' ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(34, 197, 94, 0.18)',
                      color: 'var(--color-success)',
                      fontWeight: 700,
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    ✓ Active Member
                  </span>
                ) : modalMembership?.status === 'pending' ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(234, 179, 8, 0.18)',
                      color: 'var(--color-warning)',
                      fontWeight: 700,
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                    }}
                  >
                    ⏳ Request Pending
                  </span>
                ) : modalMembership?.status === 'frozen' ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(59, 130, 246, 0.18)',
                      color: '#60a5fa',
                      fontWeight: 700,
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    ❄ Membership Frozen
                  </span>
                ) : modalMembership?.status === 'inactive' ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(156, 163, 175, 0.15)',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      border: '1px solid rgba(156, 163, 175, 0.25)',
                    }}
                  >
                    Inactive
                  </span>
                ) : (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    Not Enrolled
                  </span>
                )}
              </div>

              {/* Status Explanations */}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {loadingMembership ? (
                  'Fetching real-time membership records...'
                ) : modalMembership?.status === 'active' ? (
                  `You are an active member (${modalMembership.membershipType || 'monthly'}). You can access this facility and check in for workouts.`
                ) : modalMembership?.status === 'pending' ? (
                  'Your membership request has been submitted to gym administration and is pending approval.'
                ) : modalMembership?.status === 'frozen' ? (
                  'Your membership at this facility is currently frozen. Please contact gym staff or administration to resume access.'
                ) : modalMembership?.status === 'inactive' ? (
                  'Your previous membership has expired or is inactive. You can submit a reactivation request below.'
                ) : (
                  'Join this FitBoost partner gym to access on-site check-in, verified workout logging, and facility integration.'
                )}
              </div>

              {/* Alerts: Error or Success */}
              {membershipError && (
                <div
                  style={{
                    marginTop: 'var(--space-3)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--color-error)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{membershipError}</span>
                </div>
              )}

              {membershipSuccessMsg && (
                <div
                  style={{
                    marginTop: 'var(--space-3)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: 'var(--color-success)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  <span>{membershipSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedGym(null)}
              >
                Close
              </button>

              {modalMembership?.status === 'active' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled
                  style={{ opacity: 0.85, cursor: 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserCheck size={15} style={{ color: 'var(--color-success)' }} />
                  <span>Active Member</span>
                </button>
              ) : modalMembership?.status === 'pending' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled
                  style={{ opacity: 0.85, cursor: 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Hourglass size={15} style={{ color: 'var(--color-warning)' }} />
                  <span>Request Pending</span>
                </button>
              ) : modalMembership?.status === 'frozen' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled
                  style={{ opacity: 0.85, cursor: 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Snowflake size={15} style={{ color: '#60a5fa' }} />
                  <span>Membership Frozen</span>
                </button>
              ) : modalMembership?.status === 'inactive' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleJoinGym}
                  disabled={requestingMembership || loadingMembership}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {requestingMembership ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Reactivating...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Reactivate Membership</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleJoinGym}
                  disabled={requestingMembership || loadingMembership}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {requestingMembership ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Join Gym / Request Membership</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
