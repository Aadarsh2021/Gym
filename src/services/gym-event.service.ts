import { gymRepository } from '@/repositories/gym.repository';
import {
  GymEvent,
  GymEventAttendee,
  CreateGymEventInput,
  GymEventStatus,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

export const gymEventService = {
  /**
   * Fetch all events for a gym (Owner view: drafts, published, cancelled, completed)
   */
  async getEventsForGym(gymId: string): Promise<GymEvent[]> {
    try {
      return await gymRepository.fetchGymEvents(gymId);
    } catch (err) {
      logger.error('gymEventService.getEventsForGym failed', { gymId, err });
      throw err;
    }
  },

  /**
   * Fetch published events for member view
   */
  async getPublishedEvents(gymId: string): Promise<GymEvent[]> {
    try {
      return await gymRepository.fetchPublishedGymEvents(gymId);
    } catch (err) {
      logger.error('gymEventService.getPublishedEvents failed', { gymId, err });
      throw err;
    }
  },

  /**
   * Create a new gym event (Owner only)
   */
  async createEvent(input: CreateGymEventInput): Promise<{
    success: boolean;
    eventId?: string;
    status?: GymEventStatus;
    error?: string;
  }> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Event title is required');
    }
    if (!input.startsAt) {
      throw new Error('Event start time is required');
    }
    if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error('Event end time must be after start time');
    }
    if (input.capacity !== null && input.capacity !== undefined && input.capacity <= 0) {
      throw new Error('Event capacity must be greater than zero or left unlimited');
    }

    return await gymRepository.createGymEvent({
      gymId: input.gymId,
      title: input.title,
      description: input.description || '',
      eventType: input.eventType,
      startsAt: input.startsAt,
      endsAt: input.endsAt || '',
      capacity: input.capacity,
      locationText: input.locationText,
    });
  },

  /**
   * Transition event status (draft -> published -> completed / cancelled)
   */
  async updateStatus(
    eventId: string,
    status: GymEventStatus
  ): Promise<{ success: boolean; error?: string }> {
    return await gymRepository.updateGymEventStatus(eventId, status);
  },

  /**
   * RSVP for an event (Member only, atomic capacity check via RPC)
   */
  async rsvp(
    eventId: string
  ): Promise<{
    success: boolean;
    attendeeCount?: number;
    capacity?: number | null;
    error?: string;
  }> {
    return await gymRepository.rsvpGymEvent(eventId);
  },

  /**
   * Cancel RSVP for an event (Member only)
   */
  async cancelRsvp(
    eventId: string
  ): Promise<{ success: boolean; attendeeCount?: number; error?: string }> {
    return await gymRepository.cancelGymEventRsvp(eventId);
  },

  /**
   * Fetch attendee roster (Owner only)
   */
  async getAttendees(eventId: string): Promise<GymEventAttendee[]> {
    return await gymRepository.fetchGymEventAttendees(eventId);
  },
};
