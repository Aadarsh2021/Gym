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
      <div className="mx-auto max-w-4xl p-6 text-center text-slate-400" data-testid="no-active-gym">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-600" />
        <h3 className="text-lg font-bold text-white">Join a Gym First</h3>
        <p className="mt-1 text-sm text-slate-400">
          Gym workshops and group sessions are exclusively available to members of a registered gym.
        </p>
      </div>
    );
  }

  const displayedEvents =
    filterTab === 'my_rsvps'
      ? events.filter((e) => e.userRsvpStatus === 'attending')
      : events;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 animate-fade-in" data-testid="member-gym-events-view">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Sparkles className="h-4 w-4" />
            <span>Community Sessions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Gym Workshops &amp; Classes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Attend exclusive group coaching, bootcamps, and special training sessions at {activeGym?.name || 'your gym'}.
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchEvents();
          }}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setFilterTab('all')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            filterTab === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          All Upcoming ({events.length})
        </button>
        <button
          onClick={() => setFilterTab('my_rsvps')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            filterTab === 'my_rsvps'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          My RSVPs ({events.filter((e) => e.userRsvpStatus === 'attending').length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">
            {filterTab === 'my_rsvps' ? 'No Registered Events' : 'No Scheduled Events Right Now'}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            {filterTab === 'my_rsvps'
              ? 'You have not reserved a spot for any upcoming gym sessions.'
              : 'Your gym owner has not scheduled any open workshops or classes at this time.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedEvents.map((event) => {
            const startDate = new Date(event.startsAt);
            const isFull = event.capacity != null && (event.attendeeCount || 0) >= event.capacity;
            const isActionLoading = actionLoadingId === event.id;
            const hasRsvped = event.userRsvpStatus === 'attending';

            return (
              <div
                key={event.id}
                className={`rounded-xl border p-5 transition ${
                  hasRsvped
                    ? 'border-blue-500/30 bg-blue-950/10'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-medium capitalize">
                        {event.eventType}
                      </span>
                      {hasRsvped && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Reserved
                        </span>
                      )}
                      {isFull && !hasRsvped && (
                        <span className="rounded bg-red-950/40 px-2 py-0.5 text-xs text-red-400 border border-red-800/40">
                          Full Capacity
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white">{event.title}</h3>
                    {event.description && <p className="text-xs text-slate-400 max-w-2xl">{event.description}</p>}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {startDate.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {event.endsAt &&
                          ` - ${new Date(event.endsAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                      </span>
                      {event.locationText && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-500" />
                          {event.locationText}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-400" />
                        <span className="font-semibold text-slate-200">{event.attendeeCount || 0}</span>
                        <span>{event.capacity ? `/ ${event.capacity} spots` : 'spots (unlimited)'}</span>
                      </span>
                    </div>
                  </div>

                  {/* RSVP Actions */}
                  <div className="sm:self-center">
                    {hasRsvped ? (
                      <button
                        onClick={() => handleCancelRsvp(event.id)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/40 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>{isActionLoading ? 'Cancelling...' : 'Cancel RSVP'}</span>
                      </button>
                    ) : isFull ? (
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs font-semibold text-slate-500"
                      >
                        Fully Booked
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRsvp(event.id)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 shadow-sm"
                      >
                        <CheckCircle2 className="h-4 w-4" />
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
