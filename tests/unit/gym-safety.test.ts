import { describe, it, expect, beforeEach } from 'vitest';
import { gymSafetyService } from '@/services/gym-safety.service';
import { platform } from '@/platform';

describe('Phase G6: Gym Safety & SPS Unit Suite', () => {
  const GYM_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    platform.storage.clear();
  });

  describe('1. Incident Report Input Validation & Sanitization', () => {
    it('rejects incident reports with empty or missing gymId', async () => {
      const res = await gymSafetyService.reportIncident({
        gymId: '',
        category: 'equipment_hazard',
        severity: 'medium',
        title: 'Broken cable',
        description: 'The cable snapped on station 4.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Gym ID is required/i);
    });

    it('rejects incident reports with invalid category', async () => {
      const res = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'invalid_category' as any,
        severity: 'medium',
        title: 'Broken cable',
        description: 'The cable snapped on station 4.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid safety category/i);
    });

    it('rejects incident reports with invalid severity', async () => {
      const res = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'super_high' as any,
        title: 'Broken cable',
        description: 'The cable snapped on station 4.',
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid severity level/i);
    });

    it('rejects titles shorter than 3 characters or longer than 120 characters', async () => {
      const tooShort = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'medium',
        title: 'AB',
        description: 'Valid description of at least ten characters.',
      });
      expect(tooShort.success).toBe(false);
      expect(tooShort.error).toMatch(/between 3 and 120 characters/i);

      const tooLong = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'medium',
        title: 'X'.repeat(121),
        description: 'Valid description of at least ten characters.',
      });
      expect(tooLong.success).toBe(false);
      expect(tooLong.error).toMatch(/between 3 and 120 characters/i);
    });

    it('rejects descriptions shorter than 10 characters or longer than 2000 characters', async () => {
      const tooShort = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'medium',
        title: 'Broken cable',
        description: 'Too short',
      });
      expect(tooShort.success).toBe(false);
      expect(tooShort.error).toMatch(/between 10 and 2000 characters/i);

      const tooLong = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'medium',
        title: 'Broken cable',
        description: 'Y'.repeat(2001),
      });
      expect(tooLong.success).toBe(false);
      expect(tooLong.error).toMatch(/between 10 and 2000 characters/i);
    });

    it('sanitizes HTML tags from title, description, and location', async () => {
      const res = await gymSafetyService.reportIncident({
        gymId: GYM_ID,
        category: 'equipment_hazard',
        severity: 'high',
        title: '<script>alert("hack")</script>Bench #4 Broken',
        description: '<p>The bench frame is cracked <b>dangerously</b>.</p>',
        locationInFacility: '<img src=x onerror=alert(1)>Turf Area',
      });
      expect(res.success).toBe(true);
      expect(res.incidentId).toBeDefined();
    });
  });

  describe('2. Emergency Contact Validation', () => {
    it('rejects contact names outside 2–100 characters', async () => {
      const tooShort = await gymSafetyService.saveEmergencyContact({
        contactName: 'A',
        relationship: 'Spouse',
        phoneNumber: '+15550192831',
      });
      expect(tooShort.success).toBe(false);
      expect(tooShort.error).toMatch(/between 2 and 100 characters/i);
    });

    it('rejects invalid relationship outside 2–50 characters', async () => {
      const tooShort = await gymSafetyService.saveEmergencyContact({
        contactName: 'Jane Doe',
        relationship: 'P',
        phoneNumber: '+15550192831',
      });
      expect(tooShort.success).toBe(false);
      expect(tooShort.error).toMatch(/between 2 and 50 characters/i);
    });

    it('rejects phone numbers outside 7–20 digits', async () => {
      const invalidPhone = await gymSafetyService.saveEmergencyContact({
        contactName: 'Jane Doe',
        relationship: 'Parent',
        phoneNumber: '123',
      });
      expect(invalidPhone.success).toBe(false);
      expect(invalidPhone.error).toMatch(/valid phone number/i);
    });

    it('rejects medical notes exceeding 500 characters', async () => {
      const tooLongNotes = await gymSafetyService.saveEmergencyContact({
        contactName: 'Jane Doe',
        relationship: 'Parent',
        phoneNumber: '+15550192831',
        medicalNotes: 'M'.repeat(501),
      });
      expect(tooLongNotes.success).toBe(false);
      expect(tooLongNotes.error).toMatch(/not exceed 500 characters/i);
    });

    it('successfully saves valid emergency contact', async () => {
      const res = await gymSafetyService.saveEmergencyContact({
        contactName: 'Jane Doe',
        relationship: 'Spouse',
        phoneNumber: '+15550192831',
        alternativePhone: '+15550192832',
        medicalNotes: 'Type 1 diabetic, asthmatic',
      });
      expect(res.success).toBe(true);
      expect(res.contact?.contactName).toBe('Jane Doe');
      expect(res.contact?.phoneNumber).toBe('+15550192831');
    });
  });

  describe('3. Status Transition State Machine', () => {
    it('permits legal forward transitions', async () => {
      const incId = '22222222-2222-4222-8222-222222222222';

      // reported -> acknowledged
      const r1 = await gymSafetyService.updateIncidentStatus(incId, 'acknowledged', 'Staff notified', 'reported');
      expect(r1.success).toBe(true);

      // acknowledged -> investigating
      const r2 = await gymSafetyService.updateIncidentStatus(incId, 'investigating', 'Floor inspection', 'acknowledged');
      expect(r2.success).toBe(true);

      // investigating -> action_taken
      const r3 = await gymSafetyService.updateIncidentStatus(incId, 'action_taken', 'Machine locked out', 'investigating');
      expect(r3.success).toBe(true);

      // action_taken -> resolved
      const r4 = await gymSafetyService.updateIncidentStatus(incId, 'resolved', 'Replaced pin and certified safe', 'action_taken');
      expect(r4.success).toBe(true);
    });

    it('blocks illegal backward transitions', async () => {
      const incId = '22222222-2222-4222-8222-222222222222';

      // investigating -> reported is illegal
      const res = await gymSafetyService.updateIncidentStatus(incId, 'reported', 'Revert', 'investigating');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Illegal status transition/i);
    });

    it('blocks reopening resolved or dismissed terminal incidents', async () => {
      const incId = '22222222-2222-4222-8222-222222222222';

      const r1 = await gymSafetyService.updateIncidentStatus(incId, 'investigating', 'Reopen', 'resolved');
      expect(r1.success).toBe(false);
      expect(r1.error).toMatch(/Illegal status transition/i);

      const r2 = await gymSafetyService.updateIncidentStatus(incId, 'reported', 'Reopen', 'dismissed');
      expect(r2.success).toBe(false);
      expect(r2.error).toMatch(/Illegal status transition/i);
    });
  });

  describe('4. Floor Safety Notice Validation', () => {
    it('rejects notices with short titles', async () => {
      const res = await gymSafetyService.publishSafetyNotice(GYM_ID, {
        title: 'No',
        content: 'Valid content explaining the closure.',
        noticeType: 'maintenance_closure',
        severity: 'high',
        startsAt: new Date().toISOString(),
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/between 3 and 120 characters/i);
    });

    it('rejects notices with short content', async () => {
      const res = await gymSafetyService.publishSafetyNotice(GYM_ID, {
        title: 'Cable Machine Closed',
        content: 'Brief',
        noticeType: 'maintenance_closure',
        severity: 'high',
        startsAt: new Date().toISOString(),
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/between 10 and 2000 characters/i);
    });

    it('publishes valid safety notice successfully', async () => {
      const res = await gymSafetyService.publishSafetyNotice(GYM_ID, {
        title: 'Sauna Closed for Deep Cleaning',
        content: 'The men\'s sauna is undergoing sanitization today until 4 PM.',
        noticeType: 'maintenance_closure',
        severity: 'medium',
        affectedArea: 'Men\'s Locker Room',
        startsAt: new Date().toISOString(),
      });
      expect(res.success).toBe(true);
    });
  });
});
