# Phase G6 — Gym Safety & SPS
## Hardened API & Service Contract Specification

**Document Version:** 1.1.0 (Hardened)  
**Layer:** TypeScript Service Layer & PostgreSQL Stored Procedures  

---

## 1. Authoritative PostgreSQL RPC Signatures

### 1.1 Member-Facing RPCs

#### 1. `public.report_gym_safety_incident`
```sql
CREATE OR REPLACE FUNCTION public.report_gym_safety_incident(
    p_gym_id UUID,
    p_category TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_description TEXT,
    p_location TEXT DEFAULT NULL,
    p_reported_user_id UUID DEFAULT NULL,
    p_is_anonymous BOOLEAN DEFAULT FALSE,
    p_trigger_block BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Error Codes**:
  - `40100`: Authentication required (`auth.uid() IS NULL`)
  - `40301`: Caller is not an active member of `p_gym_id`
  - `40001`: Title, description, or category missing / invalid length
  - `40002`: Cannot report self (`p_reported_user_id = auth.uid()`)
  - `42901`: Rate limit exceeded (> 5 reports in rolling 60 minutes)

#### 2. `public.trigger_gym_emergency_sos`
```sql
CREATE OR REPLACE FUNCTION public.trigger_gym_emergency_sos(
    p_location_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Logic & Invariants**:
  - Automatically derives `v_gym_id` from the member's current active attendance session:
    ```sql
    SELECT s.id, s.gym_id, g.name INTO v_sess_id, v_gym_id, v_gym_name
    FROM public.gym_attendance_sessions s
    JOIN public.gyms g ON g.id = s.gym_id
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.check_out_at IS NULL
    ORDER BY s.check_in_at DESC
    LIMIT 1;
    ```
  - Throws `40302: Active floor attendance session required` if no active session exists.
  - **Deduplication Window**: If an unresolved SOS incident (`severity = 'critical' AND category = 'medical_emergency' AND status IN ('reported', 'acknowledged', 'investigating')`) was created for this member at this gym within the last 15 minutes, the RPC does not create a duplicate; it appends the location details and returns the existing incident ID.
  - Otherwise, inserts a new `critical` incident and appends to `gym_safety_incident_logs`.

#### 3. `public.get_my_gym_safety_incidents`
```sql
CREATE OR REPLACE FUNCTION public.get_my_gym_safety_incidents(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    gym_id UUID,
    gym_name TEXT,
    is_anonymous BOOLEAN,
    category TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    location_in_facility TEXT,
    status TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```

---

### 1.2 Owner-Facing RPCs

#### 4. `public.get_gym_safety_incidents`
```sql
CREATE OR REPLACE FUNCTION public.get_gym_safety_incidents(
    p_gym_id UUID,
    p_status_filter TEXT DEFAULT NULL,
    p_severity_filter TEXT DEFAULT NULL,
    p_limit INT DEFAULT 30,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    gym_id UUID,
    reporter_id UUID,
    reporter_name TEXT,
    reporter_avatar_url TEXT,
    is_anonymous BOOLEAN,
    category TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    location_in_facility TEXT,
    reported_user_id UUID,
    reported_user_name TEXT,
    attendance_session_id UUID,
    status TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Anonymous Protection**:
  - `reporter_id`: returned as `NULL` when `is_anonymous = true`.
  - `reporter_name`: returned as `'Anonymous Member'` when `is_anonymous = true`.
  - `reporter_avatar_url`: returned as `NULL` when `is_anonymous = true`.

#### 5. `public.get_active_member_emergency_contact`
```sql
CREATE OR REPLACE FUNCTION public.get_active_member_emergency_contact(
    p_user_id UUID,
    p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Authorization Rule**:
  - Verifies caller is verified owner of `p_gym_id`.
  - Verifies `p_user_id` has an active check-in at `p_gym_id` (`status = 'active' AND check_out_at IS NULL`).
  - If checked out: throws `40303: Member is not currently checked into this facility`.
- **Side Effect (Immutable Access Audit)**:
  - Atomically appends an audit event to `public.gym_emergency_contact_access_logs`:
    ```sql
    INSERT INTO public.gym_emergency_contact_access_logs (
        gym_id,
        member_user_id,
        viewer_owner_id,
        attendance_session_id,
        accessed_fields
    ) VALUES (
        p_gym_id,
        p_user_id,
        auth.uid(),
        v_sess_id,
        ARRAY['contact_name', 'relationship', 'phone_number', 'alternative_phone', 'medical_notes']
    );
    ```
  - **Retention & Immutability**: All four foreign keys (`gym_id`, `member_user_id`, `viewer_owner_id`, `attendance_session_id`) enforce `ON DELETE RESTRICT`, ensuring access records survive parent entity deletion.
- **Output**: Returns `{ contact_name, relationship, phone_number, alternative_phone, medical_notes }`.

#### 6. `public.update_safety_incident_status`
```sql
CREATE OR REPLACE FUNCTION public.update_safety_incident_status(
    p_incident_id UUID,
    p_new_status TEXT,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Invariants**:
  - Verifies caller owns the incident's facility.
  - Validates legal transitions (`reported` &rarr; `acknowledged` &rarr; `investigating` &rarr; `action_taken` &rarr; `resolved` / `dismissed`).
  - Reopening a resolved or dismissed incident is prohibited.
  - Automatically appends row to `gym_safety_incident_logs`.

#### 7. `public.get_safety_incident_audit_trail`
```sql
CREATE OR REPLACE FUNCTION public.get_safety_incident_audit_trail(
    p_incident_id UUID
)
RETURNS TABLE (
    id UUID,
    incident_id UUID,
    actor_id UUID,
    actor_name TEXT,
    action TEXT,
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```
- **Whistleblower / Anonymous Reporter Privacy Protection**:
  - Checks parent incident's `is_anonymous` flag and `reporter_id`.
  - For any log entry where `v_incident.is_anonymous = true` and `actor_id = v_incident.reporter_id`:
    - `actor_id` returns `NULL`.
    - `actor_name` returns `'Anonymous Member'`.
    - The profile `LEFT JOIN` uses a conditional `CASE` expression evaluating to `NULL`, preventing any profile lookup, display name, avatar, or UUID leakage.
  - Facility owners, staff, and third parties can never de-anonymize the whistleblower via audit trail queries, filters, joins, or error messages.

#### 8. `public.publish_gym_safety_notice`
```sql
CREATE OR REPLACE FUNCTION public.publish_gym_safety_notice(
    p_gym_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_notice_type TEXT,
    p_severity TEXT,
    p_affected_area TEXT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth;
```

---

## 2. TypeScript Service Layer Contract (`gym-safety.service.ts`)

```typescript
export class GymSafetyService {
  /**
   * Submits a physical safety or hazard report to the facility.
   */
  async reportIncident(payload: ReportSafetyIncidentPayload): Promise<{
    success: boolean;
    incidentId?: string;
    error?: string;
  }>;

  /**
   * Triggers an emergency SOS broadcast to gym staff.
   * Derives gym_id server-side from the active attendance session.
   */
  async triggerEmergencySos(locationDetails?: string): Promise<{
    success: boolean;
    incidentId?: string;
    gymName?: string;
    error?: string;
  }>;

  /**
   * Fetches the member's own filed reports and their current investigation status.
   */
  async getMyReportedIncidents(): Promise<GymSafetyIncident[]>;

  /**
   * Sets or updates the member's emergency contact information.
   */
  async saveEmergencyContact(contact: Omit<GymEmergencyContact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    contact?: GymEmergencyContact;
    error?: string;
  }>;

  /**
   * Fetches the member's current emergency contact (own record).
   */
  async getMyEmergencyContact(): Promise<GymEmergencyContact | null>;

  /**
   * Owner Console: Fetches safety incident queue with triage filtering.
   * Mediated exclusively through get_gym_safety_incidents RPC.
   */
  async getFacilityIncidents(
    gymId: string,
    filters?: { status?: GymSafetyIncidentStatus; severity?: GymSafetySeverity }
  ): Promise<GymSafetyIncident[]>;

  /**
   * Owner Console: Updates incident status and logs resolution notes.
   */
  async updateIncidentStatus(
    incidentId: string,
    newStatus: GymSafetyIncidentStatus,
    resolutionNotes?: string
  ): Promise<{ success: boolean; incident?: GymSafetyIncident; error?: string }>;

  /**
   * Owner Console: Retrieves immutable audit trail for a safety incident.
   */
  async getIncidentAuditTrail(incidentId: string): Promise<GymSafetyIncidentLog[]>;

  /**
   * Owner Console: Emergency lookup of checked-in athlete's next-of-kin contact.
   */
  async getActiveMemberEmergencyContact(userId: string, gymId: string): Promise<GymEmergencyContact | null>;

  /**
   * Owner Console: Publishes a high-visibility floor safety notice.
   */
  async publishSafetyNotice(
    gymId: string,
    notice: Omit<GymSafetyNotice, 'id' | 'gymId' | 'authorId' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; notice?: GymSafetyNotice; error?: string }>;

  /**
   * Fetches active floor safety notices for the member's gym.
   */
  async getActiveSafetyNotices(gymId: string): Promise<GymSafetyNotice[]>;
}

export const gymSafetyService = new GymSafetyService();
```
