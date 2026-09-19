/**
 * Gym Safety & SPS Service
 * Phase G6: Authoritative Client Service Layer
 * 
 * Enforces validation, sanitization, and delegates sensitive mutations
 * exclusively to SECURITY DEFINER PostgreSQL RPCs via GymRepository.
 */

import { gymRepository } from '@/repositories/gym.repository';
import {
  GymSafetyCategory,
  GymSafetySeverity,
  GymSafetyIncidentStatus,
  GymSafetyIncident,
  GymSafetyIncidentLog,
  GymEmergencyContact,
  GymSafetyNotice,
  ReportSafetyIncidentPayload,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';

const VALID_CATEGORIES: GymSafetyCategory[] = [
  'equipment_hazard',
  'facility_damage',
  'hygiene_sanitation',
  'member_harassment',
  'theft_security',
  'medical_emergency',
  'staff_conduct',
  'other',
];

const VALID_SEVERITIES: GymSafetySeverity[] = ['low', 'medium', 'high', 'critical'];

const LEGAL_TRANSITIONS: Record<GymSafetyIncidentStatus, GymSafetyIncidentStatus[]> = {
  reported: ['acknowledged', 'dismissed'],
  acknowledged: ['investigating', 'action_taken', 'resolved', 'dismissed'],
  investigating: ['action_taken', 'resolved', 'dismissed'],
  action_taken: ['resolved', 'dismissed'],
  resolved: [], // Terminal
  dismissed: [], // Terminal
};

export class GymSafetyService {
  /**
   * Submits a physical safety or hazard report to the facility.
   * Dispatches exclusively via report_gym_safety_incident RPC.
   */
  async reportIncident(payload: ReportSafetyIncidentPayload): Promise<{
    success: boolean;
    incidentId?: string;
    error?: string;
  }> {
    try {
      if (!payload.gymId?.trim()) {
        return { success: false, error: 'Gym ID is required.' };
      }

      if (!VALID_CATEGORIES.includes(payload.category)) {
        return { success: false, error: 'Invalid safety category selected.' };
      }

      if (!VALID_SEVERITIES.includes(payload.severity)) {
        return { success: false, error: 'Invalid severity level selected.' };
      }

      const trimmedTitle = payload.title?.trim() || '';
      if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
        return { success: false, error: 'Incident title must be between 3 and 120 characters.' };
      }

      const trimmedDesc = payload.description?.trim() || '';
      if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) {
        return { success: false, error: 'Description must be between 10 and 2000 characters.' };
      }

      // Sanitize plain text (strip suspicious tags)
      const sanitizedTitle = trimmedTitle.replace(/<[^>]*>?/gm, '');
      const sanitizedDesc = trimmedDesc.replace(/<[^>]*>?/gm, '');
      const sanitizedLoc = payload.locationInFacility?.trim().replace(/<[^>]*>?/gm, '') || undefined;

      return await gymRepository.reportSafetyIncident({
        ...payload,
        title: sanitizedTitle,
        description: sanitizedDesc,
        locationInFacility: sanitizedLoc,
      });
    } catch (err: any) {
      logger.error('GymSafetyService: reportIncident failed', { err });
      return { success: false, error: err.message || 'Failed to submit incident report.' };
    }
  }

  /**
   * Triggers an emergency SOS broadcast to gym staff.
   * Derives gym_id server-side from the member's current active attendance session.
   */
  async triggerEmergencySos(locationDetails?: string): Promise<{
    success: boolean;
    incidentId?: string;
    gymName?: string;
    isDeduplicated?: boolean;
    error?: string;
  }> {
    try {
      const sanitizedLocation = locationDetails?.trim().replace(/<[^>]*>?/gm, '');
      return await gymRepository.triggerEmergencySos(sanitizedLocation);
    } catch (err: any) {
      logger.error('GymSafetyService: triggerEmergencySos failed', { err });
      return { success: false, error: err.message || 'Failed to trigger emergency SOS.' };
    }
  }

  /**
   * Fetches the member's own filed reports and their current status.
   */
  async getMyReportedIncidents(limit = 20, offset = 0): Promise<GymSafetyIncident[]> {
    try {
      return await gymRepository.fetchMySafetyIncidents(limit, offset);
    } catch (err) {
      logger.error('GymSafetyService: getMyReportedIncidents failed', { err });
      return [];
    }
  }

  /**
   * Sets or updates the member's emergency contact information.
   */
  async saveEmergencyContact(contact: Omit<GymEmergencyContact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    contact?: GymEmergencyContact;
    error?: string;
  }> {
    try {
      const name = contact.contactName?.trim();
      if (!name || name.length < 2 || name.length > 100) {
        return { success: false, error: 'Contact name must be between 2 and 100 characters.' };
      }

      const rel = contact.relationship?.trim();
      if (!rel || rel.length < 2 || rel.length > 50) {
        return { success: false, error: 'Relationship must be between 2 and 50 characters.' };
      }

      const phone = contact.phoneNumber?.trim();
      if (!phone || phone.length < 7 || phone.length > 20) {
        return { success: false, error: 'Please enter a valid phone number (7-20 digits).' };
      }

      const altPhone = contact.alternativePhone?.trim() || null;
      if (altPhone && (altPhone.length < 7 || altPhone.length > 20)) {
        return { success: false, error: 'Alternative phone number must be between 7 and 20 characters.' };
      }

      const medNotes = contact.medicalNotes?.trim() || null;
      if (medNotes && medNotes.length > 500) {
        return { success: false, error: 'Medical notes must not exceed 500 characters.' };
      }

      return await gymRepository.saveEmergencyContact({
        contactName: name.replace(/<[^>]*>?/gm, ''),
        relationship: rel.replace(/<[^>]*>?/gm, ''),
        phoneNumber: phone.replace(/<[^>]*>?/gm, ''),
        alternativePhone: altPhone ? altPhone.replace(/<[^>]*>?/gm, '') : null,
        medicalNotes: medNotes ? medNotes.replace(/<[^>]*>?/gm, '') : null,
      });
    } catch (err: any) {
      logger.error('GymSafetyService: saveEmergencyContact failed', { err });
      return { success: false, error: err.message || 'Failed to save emergency contact.' };
    }
  }

  /**
   * Fetches the member's own registered emergency contact.
   */
  async getMyEmergencyContact(): Promise<GymEmergencyContact | null> {
    try {
      return await gymRepository.fetchMyEmergencyContact();
    } catch (err) {
      logger.error('GymSafetyService: getMyEmergencyContact failed', { err });
      return null;
    }
  }

  /**
   * Owner Console: Fetches safety incident queue with triage filtering.
   * Mediated exclusively through get_gym_safety_incidents RPC.
   */
  async getFacilityIncidents(
    gymId: string,
    filters?: { status?: GymSafetyIncidentStatus; severity?: GymSafetySeverity; limit?: number; offset?: number }
  ): Promise<GymSafetyIncident[]> {
    try {
      return await gymRepository.fetchFacilityIncidents(
        gymId,
        filters?.status,
        filters?.severity,
        filters?.limit || 30,
        filters?.offset || 0
      );
    } catch (err) {
      logger.error('GymSafetyService: getFacilityIncidents failed', { err });
      return [];
    }
  }

  /**
   * Owner Console: Updates incident status and logs resolution notes.
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: GymSafetyIncidentStatus,
    resolutionNotes?: string,
    currentStatus?: GymSafetyIncidentStatus
  ): Promise<{ success: boolean; incident?: GymSafetyIncident; error?: string }> {
    try {
      if (currentStatus) {
        const allowedNext = LEGAL_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(newStatus)) {
          return {
            success: false,
            error: `Illegal status transition from "${currentStatus}" to "${newStatus}".`,
          };
        }
      }

      const notes = resolutionNotes?.trim().replace(/<[^>]*>?/gm, '') || undefined;
      return await gymRepository.updateSafetyIncidentStatus(incidentId, newStatus, notes);
    } catch (err: any) {
      logger.error('GymSafetyService: updateIncidentStatus failed', { err });
      return { success: false, error: err.message || 'Failed to update incident status.' };
    }
  }

  /**
   * Owner Console: Retrieves immutable audit trail for a safety incident.
   */
  async getIncidentAuditTrail(incidentId: string): Promise<GymSafetyIncidentLog[]> {
    try {
      return await gymRepository.fetchSafetyIncidentAuditTrail(incidentId);
    } catch (err) {
      logger.error('GymSafetyService: getIncidentAuditTrail failed', { err });
      return [];
    }
  }

  /**
   * Owner Console: Emergency lookup of checked-in athlete's next-of-kin contact.
   * Fails immediately if the user is not currently checked in.
   */
  async getActiveMemberEmergencyContact(userId: string, gymId: string): Promise<GymEmergencyContact | null> {
    try {
      return await gymRepository.fetchActiveMemberEmergencyContact(userId, gymId);
    } catch (err) {
      logger.error('GymSafetyService: getActiveMemberEmergencyContact failed', { err });
      return null;
    }
  }

  /**
   * Owner Console: Publishes a high-visibility floor safety notice.
   */
  async publishSafetyNotice(
    gymId: string,
    notice: Omit<GymSafetyNotice, 'id' | 'gymId' | 'authorId' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<{ success: boolean; notice?: GymSafetyNotice; error?: string }> {
    try {
      const title = notice.title?.trim();
      if (!title || title.length < 3 || title.length > 120) {
        return { success: false, error: 'Notice title must be between 3 and 120 characters.' };
      }

      const content = notice.content?.trim();
      if (!content || content.length < 10 || content.length > 2000) {
        return { success: false, error: 'Notice content must be between 10 and 2000 characters.' };
      }

      return await gymRepository.publishSafetyNotice(gymId, {
        ...notice,
        title: title.replace(/<[^>]*>?/gm, ''),
        content: content.replace(/<[^>]*>?/gm, ''),
        affectedArea: notice.affectedArea?.trim().replace(/<[^>]*>?/gm, '') || undefined,
      });
    } catch (err: any) {
      logger.error('GymSafetyService: publishSafetyNotice failed', { err });
      return { success: false, error: err.message || 'Failed to publish safety notice.' };
    }
  }

  /**
   * Fetches active floor safety notices for the member's gym.
   */
  async getActiveSafetyNotices(gymId: string): Promise<GymSafetyNotice[]> {
    try {
      return await gymRepository.fetchActiveSafetyNotices(gymId);
    } catch (err) {
      logger.error('GymSafetyService: getActiveSafetyNotices failed', { err });
      return [];
    }
  }
}

export const gymSafetyService = new GymSafetyService();
