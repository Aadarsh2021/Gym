import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerGym } from '@/hooks/useOwnerGym';
import { gymEventService } from '@/services/gym-event.service';
import { GymEvent, GymEventAttendee, GymEventStatus, CreateGymEventInput } from '@/types/gym.types';
import {
  Calendar,
  Plus,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  Radio,
} from 'lucide-react';

export const OwnerEventsView: React.FC = () => {
  const { activeGym, loading: loadingGym } = useOwnerGym();

  const [events, setEvents] = useState<GymEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create Event Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    eventType: 'class' | 'workshop' | 'bootcamp' | 'seminar' | 'other';
    startsAt: string;
    endsAt: string;
    capacity: string;
    locationText: string;
  }>({
    title: '',
    description: '',
    eventType: 'class',
    startsAt: '',
    endsAt: '',
    capacity: '',
    locationText: '',
  });

  // Attendee Roster Modal State
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<GymEvent | null>(null);
  const [attendees, setAttendees] = useState<GymEventAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState<boolean>(false);

  const fetchEvents = useCallback(async () => {
    if (!activeGym?.id) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await gymEventService.getEventsForGym(activeGym.id);
      setEvents(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load gym events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeGym?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGym?.id) return;

    if (!formData.title.trim()) {
      setErrorMessage('Please provide an event title');
      return;
    }
    if (!formData.startsAt) {
      setErrorMessage('Please select start date and time');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const input: CreateGymEventInput = {
        gymId: activeGym.id,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        eventType: formData.eventType,
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : undefined,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
        locationText: formData.locationText.trim() || undefined,
      };

      const res = await gymEventService.createEvent(input);
      if (res.error) {
        setErrorMessage(res.error);
        return;
      }

      setSuccessMessage('Event created successfully as a draft');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        eventType: 'class',
        startsAt: '',
        endsAt: '',
        capacity: '',
        locationText: '',
      });
      await fetchEvents();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: GymEventStatus) => {
    try {
      setErrorMessage(null);
      const res = await gymEventService.updateStatus(eventId, newStatus);
      if (res.error) {
        setErrorMessage(res.error);
        return;
      }
      setSuccessMessage(`Event status updated to ${newStatus}`);
      await fetchEvents();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update event status');
    }
  };

  const handleOpenAttendees = async (event: GymEvent) => {
    setSelectedEventForAttendees(event);
    try {
      setLoadingAttendees(true);
      const roster = await gymEventService.getAttendees(event.id);
      setAttendees(roster);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load attendee roster');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const upcomingEvents = events.filter(
    (e) => e.status !== 'cancelled' && e.status !== 'completed' && new Date(e.startsAt) >= new Date()
  );
  const totalRsvps = events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0);
  const completedEvents = events.filter((e) => e.status === 'completed');

  if (loadingGym) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!activeGym) {
    return (
      <div className="p-6 text-center text-slate-400">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
        <p>No active gym found for this owner account.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 animate-fade-in" data-testid="owner-events-view">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Calendar className="h-4 w-4" />
            <span>Facility Schedule &amp; Events</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Gym Events &amp; Workshops</h1>
          <p className="mt-1 text-sm text-slate-400">
            Organize group fitness sessions, coaching workshops, and bootcamps for {activeGym.name}.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-500 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Event</span>
          </button>
        </div>
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

      {/* Metrics Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Upcoming Events</span>
            <Calendar className="h-5 w-5" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{upcomingEvents.length}</div>
          <div className="mt-1 text-xs text-slate-500">Scheduled ahead</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total RSVPs</span>
            <Users className="h-5 w-5" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalRsvps}</div>
          <div className="mt-1 text-xs text-slate-500">Attending members</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Sessions</span>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{completedEvents.length}</div>
          <div className="mt-1 text-xs text-slate-500">Past conducted events</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">All Time</span>
            <Clock className="h-5 w-5" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{events.length}</div>
          <div className="mt-1 text-xs text-slate-500">Total events created</div>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h3 className="text-base font-semibold text-slate-200">No Events Scheduled Yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Create workshops, bootcamps, or group training sessions for your gym members to join.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const isFull = event.capacity != null && (event.attendeeCount || 0) >= event.capacity;
            const startDate = new Date(event.startsAt);

            return (
              <div
                key={event.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                          event.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : event.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : event.status === 'completed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {event.status}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-medium capitalize">
                        {event.eventType}
                      </span>
                      {isFull && (
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
                          year: 'numeric',
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

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    <button
                      onClick={() => handleOpenAttendees(event)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Roster ({event.attendeeCount || 0})</span>
                    </button>

                    {event.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange(event.id, 'published')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <Radio className="h-3.5 w-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    {event.status === 'published' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(event.id, 'completed')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Done</span>
                        </button>
                        <button
                          onClick={() => handleStatusChange(event.id, 'cancelled')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/40"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {event.status === 'cancelled' && (
                      <span className="text-xs text-red-400 italic">Event Cancelled</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">Create New Gym Event</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Olympic Lifting Workshop"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Event Type
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e: any) => setFormData({ ...formData, eventType: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="class">Group Class</option>
                  <option value="workshop">Workshop</option>
                  <option value="bootcamp">Bootcamp</option>
                  <option value="seminar">Seminar</option>
                  <option value="other">Other Activity</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Ends At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Location / Zone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Studio 2 / Turf Area"
                    value={formData.locationText}
                    onChange={(e) => setFormData({ ...formData, locationText: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Details, prerequisites, required equipment..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Save Draft Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendee Roster Modal */}
      {selectedEventForAttendees && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl animate-fade-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Event RSVP Roster</h3>
                <p className="text-xs text-slate-400">{selectedEventForAttendees.title}</p>
              </div>
              <button
                onClick={() => setSelectedEventForAttendees(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingAttendees ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              ) : attendees.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                  No members have RSVP&apos;d for this event yet.
                </div>
              ) : (
                attendees.map((att) => (
                  <div
                    key={att.rsvpId || att.userId}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                        {(att.displayName || 'M')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{att.displayName}</p>
                        <p className="text-[10px] text-slate-400">
                          RSVP: {new Date(att.rsvpCreatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      Confirmed
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-slate-800 pt-3 text-right">
              <button
                onClick={() => setSelectedEventForAttendees(null)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
