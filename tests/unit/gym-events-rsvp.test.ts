import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gymEventService } from '@/services/gym-event.service';
import { gymRepository } from '@/repositories/gym.repository';
import { CreateGymEventInput, GymEvent, GymEventAttendee } from '@/types/gym.types';

describe('Gym Events & RSVP — Unit & Service Tests', () => {
  const dummyEvent: GymEvent = {
    id: 'evt-001-uuid',
    gymId: 'gym-001-uuid',
    createdBy: 'owner-001-uuid',
    title: 'Olympic Lifting Seminar',
    description: 'Snatch & Clean & Jerk technique deep dive',
    eventType: 'workshop',
    startsAt: '2026-10-01T10:00:00.000Z',
    endsAt: '2026-10-01T12:00:00.000Z',
    capacity: 20,
    locationText: 'Platform Zone A',
    status: 'draft',
    attendeeCount: 0,
    userRsvpStatus: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. rejects event creation when title is empty', async () => {
    const input: CreateGymEventInput = {
      gymId: 'gym-001-uuid',
      title: '   ',
      eventType: 'class',
      startsAt: '2026-10-01T10:00:00.000Z',
    };
    await expect(gymEventService.createEvent(input)).rejects.toThrow('Event title is required');
  });

  it('2. rejects event creation when start time is missing', async () => {
    const input: any = {
      gymId: 'gym-001-uuid',
      title: 'Valid Title',
      eventType: 'class',
      startsAt: '',
    };
    await expect(gymEventService.createEvent(input)).rejects.toThrow('Event start time is required');
  });

  it('3. rejects event creation when end time is before start time', async () => {
    const input: CreateGymEventInput = {
      gymId: 'gym-001-uuid',
      title: 'Evening Bootcamp',
      eventType: 'bootcamp',
      startsAt: '2026-10-01T18:00:00.000Z',
      endsAt: '2026-10-01T17:00:00.000Z',
    };
    await expect(gymEventService.createEvent(input)).rejects.toThrow('Event end time must be after start time');
  });

  it('4. rejects event creation when capacity is zero or negative', async () => {
    const input: CreateGymEventInput = {
      gymId: 'gym-001-uuid',
      title: 'Evening Bootcamp',
      eventType: 'bootcamp',
      startsAt: '2026-10-01T18:00:00.000Z',
      capacity: 0,
    };
    await expect(gymEventService.createEvent(input)).rejects.toThrow('Event capacity must be greater than zero');
  });

  it('5. allows event creation with unlimited capacity (null capacity)', async () => {
    const spy = vi.spyOn(gymRepository, 'createGymEvent').mockResolvedValue({
      success: true,
      eventId: 'evt-unlimited',
      status: 'draft',
    });

    const input: CreateGymEventInput = {
      gymId: 'gym-001-uuid',
      title: 'Community Open Day',
      eventType: 'other',
      startsAt: '2026-10-05T09:00:00.000Z',
      capacity: null,
    };

    const res = await gymEventService.createEvent(input);
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ capacity: null }));
  });

  it('6. creates event with draft status by default', async () => {
    vi.spyOn(gymRepository, 'createGymEvent').mockResolvedValue({
      success: true,
      eventId: dummyEvent.id,
      status: 'draft',
    });

    const res = await gymEventService.createEvent({
      gymId: dummyEvent.gymId,
      title: dummyEvent.title,
      eventType: dummyEvent.eventType,
      startsAt: dummyEvent.startsAt,
    });

    expect(res.status).toBe('draft');
  });

  it('7. transitions event status from draft to published', async () => {
    const spy = vi.spyOn(gymRepository, 'updateGymEventStatus').mockResolvedValue({ success: true });
    const res = await gymEventService.updateStatus(dummyEvent.id, 'published');
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(dummyEvent.id, 'published');
  });

  it('8. transitions event status from published to completed', async () => {
    const spy = vi.spyOn(gymRepository, 'updateGymEventStatus').mockResolvedValue({ success: true });
    const res = await gymEventService.updateStatus(dummyEvent.id, 'completed');
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(dummyEvent.id, 'completed');
  });

  it('9. transitions event status to cancelled', async () => {
    const spy = vi.spyOn(gymRepository, 'updateGymEventStatus').mockResolvedValue({ success: true });
    const res = await gymEventService.updateStatus(dummyEvent.id, 'cancelled');
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith(dummyEvent.id, 'cancelled');
  });

  it('10. owner view fetches all events for gym', async () => {
    const list: GymEvent[] = [
      dummyEvent,
      { ...dummyEvent, id: 'evt-002', status: 'published' },
      { ...dummyEvent, id: 'evt-003', status: 'cancelled' },
    ];
    vi.spyOn(gymRepository, 'fetchGymEvents').mockResolvedValue(list);

    const res = await gymEventService.getEventsForGym('gym-001-uuid');
    expect(res).toHaveLength(3);
  });

  it('11. member view fetches published events for gym', async () => {
    const publishedList: GymEvent[] = [
      { ...dummyEvent, id: 'evt-002', status: 'published' },
    ];
    vi.spyOn(gymRepository, 'fetchPublishedGymEvents').mockResolvedValue(publishedList);

    const res = await gymEventService.getPublishedEvents('gym-001-uuid');
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe('published');
  });

  it('12. member can successfully RSVP for available event', async () => {
    const spy = vi.spyOn(gymRepository, 'rsvpGymEvent').mockResolvedValue({
      success: true,
      attendeeCount: 1,
      capacity: 20,
    });

    const res = await gymEventService.rsvp('evt-001-uuid');
    expect(res.success).toBe(true);
    expect(res.attendeeCount).toBe(1);
    expect(spy).toHaveBeenCalledWith('evt-001-uuid');
  });

  it('13. handles duplicate RSVP idempotently without increasing count', async () => {
    vi.spyOn(gymRepository, 'rsvpGymEvent').mockResolvedValue({
      success: true,
      attendeeCount: 5,
      capacity: 20,
    });

    const res = await gymEventService.rsvp('evt-001-uuid');
    expect(res.success).toBe(true);
    expect(res.attendeeCount).toBe(5);
  });

  it('14. returns error when attempting to RSVP for fully booked event', async () => {
    vi.spyOn(gymRepository, 'rsvpGymEvent').mockResolvedValue({
      success: false,
      error: 'Event is fully booked (capacity reached)',
    });

    const res = await gymEventService.rsvp('evt-full');
    expect(res.success).toBe(false);
    expect(res.error).toContain('fully booked');
  });

  it('15. allows member to cancel their own RSVP', async () => {
    const spy = vi.spyOn(gymRepository, 'cancelGymEventRsvp').mockResolvedValue({
      success: true,
      attendeeCount: 0,
    });

    const res = await gymEventService.cancelRsvp('evt-001-uuid');
    expect(res.success).toBe(true);
    expect(spy).toHaveBeenCalledWith('evt-001-uuid');
  });

  it('16. handles cancel RSVP when no existing reservation exists', async () => {
    vi.spyOn(gymRepository, 'cancelGymEventRsvp').mockResolvedValue({
      success: true,
      attendeeCount: 0,
    });

    const res = await gymEventService.cancelRsvp('evt-no-prior-rsvp');
    expect(res.success).toBe(true);
  });

  it('17. fetches attendee roster for gym event', async () => {
    const roster: GymEventAttendee[] = [
      {
        rsvpId: 'rsvp-1',
        userId: 'user-athlete-1',
        displayName: 'John Doe',
        avatarUrl: null,
        rsvpStatus: 'attending',
        rsvpCreatedAt: '2026-09-20T12:00:00.000Z',
      },
      {
        rsvpId: 'rsvp-2',
        userId: 'user-athlete-2',
        displayName: 'Jane Smith',
        avatarUrl: 'https://example.com/avatar.jpg',
        rsvpStatus: 'attending',
        rsvpCreatedAt: '2026-09-20T13:00:00.000Z',
      },
    ];
    vi.spyOn(gymRepository, 'fetchGymEventAttendees').mockResolvedValue(roster);

    const attendees = await gymEventService.getAttendees('evt-001-uuid');
    expect(attendees).toHaveLength(2);
    expect(attendees[0].displayName).toBe('John Doe');
    expect(attendees[1].displayName).toBe('Jane Smith');
  });

  it('18. returns empty attendee roster when no members have RSVPd', async () => {
    vi.spyOn(gymRepository, 'fetchGymEventAttendees').mockResolvedValue([]);
    const attendees = await gymEventService.getAttendees('evt-empty');
    expect(attendees).toEqual([]);
  });

  it('19. handles repository exception in getEventsForGym gracefully', async () => {
    vi.spyOn(gymRepository, 'fetchGymEvents').mockRejectedValue(new Error('DB Network Timeout'));
    await expect(gymEventService.getEventsForGym('gym-001-uuid')).rejects.toThrow('DB Network Timeout');
  });

  it('20. handles repository exception in getPublishedEvents gracefully', async () => {
    vi.spyOn(gymRepository, 'fetchPublishedGymEvents').mockRejectedValue(new Error('Gym not found'));
    await expect(gymEventService.getPublishedEvents('gym-missing')).rejects.toThrow('Gym not found');
  });

  it('21. returns error when updateStatus RPC fails', async () => {
    vi.spyOn(gymRepository, 'updateGymEventStatus').mockResolvedValue({
      success: false,
      error: 'Unauthorized: only owner may modify event status',
    });

    const res = await gymEventService.updateStatus('evt-001', 'published');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });
});
