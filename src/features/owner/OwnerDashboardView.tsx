import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerGym } from '@/context/OwnerGymContext';
import { gymRepository } from '@/repositories/gym.repository';
import { GymAttendanceSession } from '@/types/gym.types';
import {
  Building2,
  Users,
  Clock,
  MapPin,
  PlusCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OwnerDashboardView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  const [activeSessions, setActiveSessions] = useState<GymAttendanceSession[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [todayCheckins, setTodayCheckins] = useState<number>(0);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);

  const fetchRealMetrics = useCallback(async () => {
    if (!activeGym) {
      setLoadingMetrics(false);
      return;
    }

    try {
      setLoadingMetrics(true);
      const [sessions, members, checkins] = await Promise.all([
        gymRepository.fetchGymActiveAttendance(activeGym.id),
        gymRepository.fetchGymMemberCount(activeGym.id),
        gymRepository.fetchGymTodayCheckinsCount(activeGym.id),
      ]);

      setActiveSessions(sessions);
      setMemberCount(members);
      setTodayCheckins(checkins);
    } catch {
      // Fallback
    } finally {
      setLoadingMetrics(false);
    }
  }, [activeGym]);

  useEffect(() => {
    fetchRealMetrics();
  }, [fetchRealMetrics]);

  if (loadingGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '1200px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading facility console...</div>
      </div>
    );
  }

  // 1. OWNER WITHOUT A GYM
  if (!activeGym) {
    return (
      <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: '900px' }}>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto var(--space-6)', lineHeight: 1.5 }}>
            To begin managing your facility, monitoring live gym attendance, and configuring member check-ins, register your gym location.
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

  // 2. OWNER WITH ACTIVE GYM — Real Live Dashboard
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)', maxWidth: '1200px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            <Building2 size={16} />
            <span>FACILITY CONSOLE</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeGym.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} />
            <span>{activeGym.address}, {activeGym.city}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link to="/owner/profile" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Edit Facility</span>
          </Link>
          <Link to="/owner/onboarding" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)' }}>
            <PlusCircle size={15} />
            <span>Add Another Gym</span>
          </Link>
        </div>
      </div>

      {/* Operational Metrics Cards (100% Real Supabase Data) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {/* Currently in Gym */}
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-success)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Currently Inside</span>
            <Activity size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics ? '--' : activeSessions.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active attendance sessions</div>
        </div>

        {/* Today's Check-ins */}
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-gold)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Today's Check-ins</span>
            <Clock size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics ? '--' : todayCheckins}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed & active visits</div>
        </div>

        {/* Registered Active Members */}
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enrolled Athletes</span>
            <Users size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {loadingMetrics ? '--' : memberCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified active passes</div>
        </div>

        {/* Geofence Perimeter */}
        <div className="card card-elevated" style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--accent-cyan)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Check-in Perimeter</span>
            <MapPin size={20} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            {activeGym.radiusMeters}m
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GPS geofence radius</div>
        </div>
      </div>

      {/* Currently Inside Gym Live Section */}
      <div className="card card-elevated" style={{ padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-glass-card)', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
              }}
            />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Currently Inside Gym</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {activeSessions.length} athlete{activeSessions.length === 1 ? '' : 's'} on floor
          </span>
        </div>

        {activeSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
            <Activity size={36} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-2)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
              No athletes are currently checked in.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '10px 12px' }}>ATHLETE</th>
                  <th style={{ padding: '10px 12px' }}>CHECK-IN TIME</th>
                  <th style={{ padding: '10px 12px' }}>ELAPSED</th>
                  <th style={{ padding: '10px 12px' }}>METHOD</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map(session => {
                  const checkInDate = new Date(session.checkInAt);
                  const timeFormatted = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true,
                  }).format(checkInDate);

                  const minutesElapsed = Math.max(
                    1,
                    Math.floor((Date.now() - checkInDate.getTime()) / (1000 * 60))
                  );

                  return (
                    <tr key={session.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            {session.userProfile?.displayName?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <span style={{ fontWeight: 600 }}>
                            {session.userProfile?.displayName || 'Athlete'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        {timeFormatted}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-gold)' }}>
                        {minutesElapsed} min
                      </td>
                      <td style={{ padding: '12px', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                        {session.verificationMethod.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', fontSize: '0.75rem' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Facility Operations Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <Link
          to="/owner/members"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)' }}>
              <Users size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Member Roster</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            View athlete directory, manage passes, and track check-in frequency.
          </p>
        </Link>

        <Link
          to="/owner/events"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-gold)' }}>
              <Calendar size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Events & Workshops</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Publish group workout sessions, bootcamp classes, and seminar schedules.
          </p>
        </Link>

        <Link
          to="/owner/settings"
          className="card card-elevated"
          style={{
            padding: 'var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-glass-card)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 150ms ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-success)' }}>
              <ShieldCheck size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Facility Settings</h3>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Configure QR codes, adjust geofence perimeter, and update notification preferences.
          </p>
        </Link>
      </div>
    </div>
  );
};
