import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';

describe('Phase G1: Facility Announcements', () => {
  const gymA = 'mock-gym-alpha';
  const gymB = 'mock-gym-beta';
  const ownerId = 'mock-owner-1';

  beforeEach(() => {
    platform.storage.removeItem(`gym_announcements_${gymA}`);
    platform.storage.removeItem(`gym_announcements_${gymB}`);
  });

  it('allows gym owner to create announcements', async () => {
    const res = await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Holiday Schedule Notice',
      content: 'Gym will close at 6 PM on Sunday.',
      priority: 'high',
      isPinned: false,
      status: 'published',
      createdBy: ownerId,
    });

    expect(res.success).toBe(true);
    expect(res.announcement).toBeDefined();
    expect(res.announcement?.title).toBe('Holiday Schedule Notice');
    expect(res.announcement?.priority).toBe('high');
    expect(res.announcement?.isPinned).toBe(false);

    const list = await gymRepository.fetchGymAnnouncements(gymA, true);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(res.announcement?.id);
  });

  it('correctly prioritizes pinned announcements at the top of the feed', async () => {
    // Announcement 1: older, unpinned
    await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Standard Notice 1',
      content: 'Lockers will be cleaned.',
      priority: 'normal',
      isPinned: false,
      status: 'published',
      createdBy: ownerId,
    });

    // Announcement 2: newer, pinned
    const pinnedRes = await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'URGENT: New Squat Racks Available',
      content: 'Check out the new Olympic platforms in Room B.',
      priority: 'urgent',
      isPinned: true,
      status: 'published',
      createdBy: ownerId,
    });

    const feed = await gymRepository.fetchGymAnnouncements(gymA, false);
    expect(feed.length).toBe(2);
    // Pinned notice must come first
    expect(feed[0].id).toBe(pinnedRes.announcement?.id);
    expect(feed[0].isPinned).toBe(true);
  });

  it('filters out expired announcements for active members', async () => {
    // Create an announcement that expired yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Past Workshop',
      content: 'Bench press seminar was yesterday.',
      priority: 'normal',
      isPinned: false,
      status: 'published',
      expiresAt: yesterday,
      createdBy: ownerId,
    });

    // Create an active announcement
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const activeRes = await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Upcoming Bootcamp',
      content: 'Saturday morning bootcamp at 7 AM.',
      priority: 'high',
      isPinned: false,
      status: 'published',
      expiresAt: future,
      createdBy: ownerId,
    });

    // Member view (isOwner: false)
    const memberFeed = await gymRepository.fetchGymAnnouncements(gymA, false);
    expect(memberFeed.length).toBe(1);
    expect(memberFeed[0].id).toBe(activeRes.announcement?.id);

    // Owner view (isOwner: true) sees all records including expired
    const ownerFeed = await gymRepository.fetchGymAnnouncements(gymA, true);
    expect(ownerFeed.length).toBe(2);
  });

  it('allows owner to update, pin/unpin, and delete announcements', async () => {
    const created = await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Maintenance Alert',
      content: 'Steam room closed.',
      priority: 'normal',
      isPinned: false,
      status: 'published',
      createdBy: ownerId,
    });

    const announcementId = created.announcement!.id;

    // Pin it
    const updateRes = await gymRepository.updateGymAnnouncement(announcementId, {
      gymId: gymA,
      isPinned: true,
      title: 'Maintenance Alert (Updated)',
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.announcement?.isPinned).toBe(true);
    expect(updateRes.announcement?.title).toBe('Maintenance Alert (Updated)');

    // Delete it
    const deleteRes = await gymRepository.deleteGymAnnouncement(announcementId, gymA);
    expect(deleteRes.success).toBe(true);

    const listAfterDelete = await gymRepository.fetchGymAnnouncements(gymA, true);
    expect(listAfterDelete.find(a => a.id === announcementId)).toBeUndefined();
  });

  it('MULTI-TENANCY: strictly isolates announcements between Gym A and Gym B', async () => {
    // Gym A notice
    await gymRepository.createGymAnnouncement({
      gymId: gymA,
      title: 'Gym A Private Alert',
      content: 'Only for Gym A members.',
      priority: 'normal',
      isPinned: false,
      status: 'published',
      createdBy: ownerId,
    });

    // Gym B notice
    await gymRepository.createGymAnnouncement({
      gymId: gymB,
      title: 'Gym B Private Alert',
      content: 'Only for Gym B members.',
      priority: 'normal',
      isPinned: false,
      status: 'published',
      createdBy: 'mock-owner-2',
    });

    const feedA = await gymRepository.fetchGymAnnouncements(gymA, false);
    const feedB = await gymRepository.fetchGymAnnouncements(gymB, false);

    expect(feedA.length).toBe(1);
    expect(feedA[0].title).toBe('Gym A Private Alert');

    expect(feedB.length).toBe(1);
    expect(feedB[0].title).toBe('Gym B Private Alert');
  });
});
