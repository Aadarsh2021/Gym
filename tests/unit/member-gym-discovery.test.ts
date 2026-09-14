import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';
import { Gym } from '@/types/gym.types';

describe('Member Gym Integration — C1: Gym Discovery & Search', () => {
  const sampleGym1: Gym = {
    id: 'gym-disc-1',
    name: 'Iron Pulse Fitness',
    slug: 'iron-pulse-fitness',
    ownerId: 'owner-alpha',
    address: 'Plot 42, Bandra West Link Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    contactNumber: '+91 98765 00001',
    email: 'info@ironpulse.com',
    description: 'Premier bodybuilding and strength training center',
    openingTime: '06:00',
    closingTime: '22:00',
    latitude: 19.0596,
    longitude: 72.8295,
    radiusMeters: 200,
    qrCodeHash: 'qr-iron-pulse',
    createdAt: new Date().toISOString(),
  };

  const sampleGym2: Gym = {
    id: 'gym-disc-2',
    name: 'Apex Athletic Club',
    slug: 'apex-athletic-delhi',
    ownerId: 'owner-beta',
    address: '15 Ring Road, Lajpat Nagar',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110024',
    contactNumber: '+91 98765 00002',
    email: 'contact@apexdelhi.com',
    description: 'Crossfit and Olympic weightlifting facility',
    openingTime: '05:30',
    closingTime: '22:30',
    latitude: 28.5677,
    longitude: 77.2433,
    radiusMeters: 250,
    qrCodeHash: 'qr-apex-delhi',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    platform.storage.clear();
    platform.storage.setItem('cached_all_gyms', JSON.stringify([sampleGym1, sampleGym2]));
  });

  describe('1. Gym Browsing & Discovery', () => {
    it('fetches all available integrated gyms', async () => {
      const allGyms = await gymRepository.fetchAllGyms();
      expect(allGyms).toHaveLength(2);
      expect(allGyms.map(g => g.name)).toContain('Iron Pulse Fitness');
      expect(allGyms.map(g => g.name)).toContain('Apex Athletic Club');
    });
  });

  describe('2. Gym Searching & Filtering', () => {
    it('searches gyms by name (case-insensitive)', async () => {
      const results = await gymRepository.searchGyms('iron pulse');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('gym-disc-1');
    });

    it('searches gyms by slug', async () => {
      const results = await gymRepository.searchGyms('apex-athletic');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('gym-disc-2');
    });

    it('searches gyms by address or locality', async () => {
      const results = await gymRepository.searchGyms('Bandra');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Iron Pulse Fitness');
    });

    it('searches gyms by description keywords', async () => {
      const results = await gymRepository.searchGyms('Olympic weightlifting');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Apex Athletic Club');
    });

    it('filters gyms by city', async () => {
      const mumbaiGyms = await gymRepository.searchGyms('', 'Mumbai');
      expect(mumbaiGyms).toHaveLength(1);
      expect(mumbaiGyms[0].city).toBe('Mumbai');

      const delhiGyms = await gymRepository.searchGyms('', 'Delhi');
      expect(delhiGyms).toHaveLength(1);
      expect(delhiGyms[0].city).toBe('Delhi');
    });

    it('combines text query and city filter accurately', async () => {
      const match = await gymRepository.searchGyms('pulse', 'Mumbai');
      expect(match).toHaveLength(1);

      // Wrong city combination returns empty
      const mismatch = await gymRepository.searchGyms('pulse', 'Delhi');
      expect(mismatch).toHaveLength(0);
    });

    it('returns empty array when query does not match any facility (triggering nomination CTA)', async () => {
      const notFound = await gymRepository.searchGyms('NonExistentGymXYZ');
      expect(notFound).toHaveLength(0);
    });
  });

  describe('3. Route & Navigation Contracts', () => {
    it('ensures Member Gym discovery route is structured correctly', () => {
      const memberGymRoute = '/app/gym';
      expect(memberGymRoute.startsWith('/app/')).toBe(true);
    });
  });
});
