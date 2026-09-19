import React, { useState, useEffect, useCallback } from 'react';
import { useMemberGymContext } from '@/hooks/useMemberGymContext';
import { gymEventService } from '@/services/gym-event.service';
import { GymEvent } from '@/types/gym.types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  XCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const MemberGymEventsView: React.FC = () => {
  let memberGymCtx: ReturnType<typeof useMemberGymContext> | null = null;
  try {
    memberGymCtx = useMemberGymContext();
  } catch {
    memberGymCtx = null;
  }
  const activeGym = memberGymCtx?.activeGym;
  const activeGymId = activeGym?.id;

  const [events, setEvents] = useState<GymEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'my_rsvps'>('all');

  const fetchEvents = useCallback(async () => {
    if (!activeGymId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await gymEventService.getPublishedEvents(activeGymId);
      setEvents(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load gym events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeGymId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRsvp = async (eventId: string) => {
    try {
      setActionLoadingId(eventId);
      setErrorMessage(null);
      const res = await gymEventService.rsvp(eventId);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('Spot reserved! See you at the session.');
        await fetchEvents();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to RSVP for event');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRsvp = async (eventId: string) => {
    try {
      setActionLoadingId(eventId);
      setErrorMessage(null);
      const res = await gymEventService.cancelRsvp(eventId);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage('RSVP cancelled.');
        await fetchEvents();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel RSVP');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!activeGymId) {
    return (
      <div className="container-narrow text-center" style={{ padding: 'var(--space-10) var(--space-4)' }} data-testid="no-active-gym">
        <div className="card card-elevated" style={{ padding: 'var(--space-8)' }}>
          <Calendar size={42} style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>Join a Gym First</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
            Gym workshops, coaching clinics, and group sessions are exclusively available to members of a registered partner facility.
          </p>
        </div>
      </div>
    );
  }

  const displayedEvents =
    filterTab === 'my_rsvps'
      ? events.filter((e) => e.userRsvpStatus === 'attending')
      : events;

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-4) var(--space-4) var(--space-12)', maxWidth: '960px' }} data-testid="member-gym-events-view">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', marginBottom: '4px' }}>
            <Sparkles size={14} />
            <span>Community Sessions</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Gym Workshops &amp; Classes</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Attend exclusive coaching clinics, bootcamps, and special training sessions at {activeGym?.name || 'your gym'}.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchEvents();
          }}
          disabled={refreshing || loading}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.85rem' }}>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button
          onClick={() => setFilterTab('all')}
          className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        >
          All Upcoming ({events.length})
        </button>
        <button
          onClick={() => setFilterTab('my_rsvps')}
          className={`btn btn-sm ${filterTab === 'my_rsvps' ? 'btn-primary' : 'btn-ghost'}`}
        >
          My RSVPs ({events.filter((e) => e.userRsvpStatus === 'attending').length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px' }}>
          <div className="spinner" style={{ width: '28px', height: '28px' }} />
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="card card-elevated text-center" style={{ padding: 'var(--space-10)' }}>
          <Calendar size={44} style={{ margin: '0 auto var(--space-3)', color: 'var(--text-muted)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {filterTab === 'my_rsvps' ? 'No Registered Sessions' : 'No Scheduled Sessions Right Now'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
            {filterTab === 'my_rsvps'
              ? 'You have not reserved a spot for any upcoming gym sessions.'
              : 'Your facility team has not scheduled any open workshops or classes at this time.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {displayedEvents.map((event) => {
            const startDate = new Date(event.startsAt);
            const isFull = event.capacity != null && (event.attendeeCount || 0) >= event.capacity;
            const isActionLoading = actionLoadingId === event.id;
            const hasRsvped = event.userRsvpStatus === 'attending';

            return (
              <div
                key={event.id}
                className="card card-elevated"
                style={{
                  padding: 'var(--space-5)',
                  border: hasRsvped ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
                  background: hasRsvped ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--bg-surface) 100%)' : 'var(--bg-surface)',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-indigo" style={{ textTransform: 'capitalize' }}>
                        {event.eventType}
                      </span>
                      {hasRsvped && (
                        <span className="badge badge-success">
                          <CheckCircle2 size={12} />
                          <span>Reserved</span>
                        </span>
                      )}
                      {isFull && !hasRsvped && (
                        <span className="badge badge-error">
                          Full Capacity
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{event.title}</h3>
                    {event.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '600px' }}>{event.description}</p>}

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                        {startDate.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                        {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {event.endsAt &&
                          ` - ${new Date(event.endsAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                      </span>
                      {event.locationText && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={14} style={{ color: 'var(--accent-primary)' }} />
                          {event.locationText}
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Users size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{event.attendeeCount || 0}</span>
                        <span>{event.capacity ? `/ ${event.capacity} spots` : 'spots (unlimited)'}</span>
                      </span>
                    </div>
                  </div>

                  {/* RSVP Actions */}
                  <div>
                    {hasRsvped ? (
                      <button
                        onClick={() => handleCancelRsvp(event.id)}
                        disabled={isActionLoading}
                        className="btn btn-danger btn-sm"
                      >
                        <XCircle size={14} />
                        <span>{isActionLoading ? 'Cancelling...' : 'Cancel RSVP'}</span>
                      </button>
                    ) : isFull ? (
                      <button
                        disabled
                        className="btn btn-secondary btn-sm"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      >
                        Fully Booked
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRsvp(event.id)}
                        disabled={isActionLoading}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 size={14} />
                        <span>{isActionLoading ? 'Reserving...' : 'RSVP Now'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
