# Phase G6 — Gym Safety & SPS (Safety & Protection System)
## Hardened Data & Architecture Specification

**Document Version:** 1.1.0 (Hardened)  
**Status:** SPECIFICATION ONLY — PENDING IMPLEMENTATION APPROVAL  
**Target Schema:** `public`  

---

## 1. System Architecture & Information Flow

```
                      ┌────────────────────────────────────────┐
                      │          AUTH / JWT IDENTITY           │
                      │       auth.uid() = Verified User       │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
   ┌──────────────────────────────┐                ┌──────────────────────────────┐
   │        MEMBER CLIENT         │                │     FACILITY OWNER CLIENT    │
   │  - Submit Safety Incident    │                │  - Triage Safety Queue       │
   │  - Trigger Emergency SOS     │                │  - Update Incident Status    │
   │  - Manage Emergency Contact  │                │  - Lookup Emergency Contact  │
   │  - View Own Reported Status  │                │  - Publish Floor Notice      │
   └──────────────┬───────────────┘                └──────────────┬───────────────┘
                  │                                               │
                  ▼                                               ▼
   ┌──────────────────────────────┐                ┌──────────────────────────────┐                ┌──────────────────────────────┐
   │    MEMBER RPC INGRESS        │                │     OWNER RPC INGRESS        │
   │ - report_gym_safety_incident │                │ - get_gym_safety_incidents   │
   │ - trigger_gym_emergency_sos  │                │ - update_safety_incident_    │
   │ - set_emergency_contact      │                │   status                     │
   │ - get_my_gym_safety_incidents│                │ - get_active_member_         │
   │                              │                │   emergency_contact          │
   │                              │                │ - get_safety_incident_audit  │
   │                              │                │ - publish_gym_safety_notice  │
   └──────────────┬───────────────┘                └──────────────┬───────────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
               (SECURITY DEFINER + search_path = public, auth)
                                          ▼
═════════════════════════════════════════════════════════════════════════════════════════════
                               POSTGRESQL STORAGE & ZERO-TRUST RLS
═════════════════════════════════════════════════════════════════════════════════════════════
  ┌────────────────────────────┐    ON DELETE    ┌────────────────────────────┐
  │    gym_safety_incidents    │─── RESTRICT ───▶│  gym_safety_incident_logs  │
  │ Direct SELECT: Author ONLY │                 │ Direct SELECT: ALL DENIED  │
  │ Direct Mutation: ALL DENIED│                 │ Direct Mutation: ALL DENIED│
  └────────────────────────────┘                 └────────────────────────────┘
                │
                ▼
  ┌────────────────────────────┐                 ┌────────────────────────────┐
  │     gym_safety_notices     │                 │   gym_emergency_contacts   │
  │ Direct SELECT: Active Mems │                 │ Direct SELECT: Member ONLY │
  │ Direct Mutation: ALL DENIED│                 │ Direct Mutation: Member    │
  └────────────────────────────┘                 └────────────────────────────┘
                                                                │
                                                ON DELETE       ▼
                                                RESTRICT ┌────────────────────────────┐
                                                (4 FKs)  │gym_emergency_contact_      │
                                                         │       access_logs          │
                                                         │ Direct SELECT: Member ONLY │
                                                         │ Direct Mutation: ALL DENIED│
                                                         └────────────────────────────┘
```

---

## 2. Hardened Table Specifications

### 2.1 Table: `public.gym_safety_incidents`

| Attribute | Specification |
| :--- | :--- |
| **Table Name** | `public.gym_safety_incidents` |
| **Purpose** | Authoritative repository of physical safety reports, hazards, medical emergencies, and member conduct incidents. |
| **Key Columns** | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`<br>`gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE`<br>`reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`<br>`is_anonymous BOOLEAN DEFAULT FALSE NOT NULL`<br>`category TEXT NOT NULL CHECK (category IN ('equipment_hazard', 'facility_hazard', 'medical_emergency', 'member_harassment', 'theft_security', 'sanitation_hygiene', 'other'))`<br>`severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low'))`<br>`title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120)`<br>`description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000)`<br>`location_in_facility TEXT CHECK (char_length(location_in_facility) <= 120)`<br>`reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL`<br>`attendance_session_id UUID REFERENCES public.gym_attendance_sessions(id) ON DELETE SET NULL`<br>`status TEXT DEFAULT 'reported' NOT NULL CHECK (status IN ('reported', 'acknowledged', 'investigating', 'action_taken', 'resolved', 'dismissed'))`<br>`resolution_notes TEXT CHECK (char_length(resolution_notes) <= 2000)`<br>`resolved_at TIMESTAMPTZ`<br>`resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL`<br>`created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`CONSTRAINT chk_no_self_report CHECK (reported_user_id IS NULL OR reported_user_id != reporter_id)` |
| **Hardened RLS** | **SELECT**: Allowed **ONLY** for `reporter_id = auth.uid()`. Facility owners are **DENIED direct SELECT** to prevent raw column exposure of `reporter_id`. Reported users are **DENIED direct SELECT**.<br>**INSERT**: Direct client insert **DENIED** (`WITH CHECK (FALSE)`).<br>**UPDATE**: Direct client update **DENIED** (`USING (FALSE)`).<br>**DELETE**: Direct client delete **DENIED** (`USING (FALSE)`). Permanent retention for insurance and liability. |
| **Mutation Path** | Exclusively via `report_gym_safety_incident()` and `update_safety_incident_status()`. |
| **Protected Columns**| `reporter_id`, `gym_id`, `created_at`, `status`, `resolved_by`, `resolved_at`, `attendance_session_id` are server-managed and immutable to clients. |

### 2.2 Table: `public.gym_safety_incident_logs`

| Attribute | Specification |
| :--- | :--- |
| **Table Name** | `public.gym_safety_incident_logs` |
| **Purpose** | Tamper-proof, immutable append-only audit trail recording every lifecycle transition and investigation note. |
| **Key Columns** | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`<br>`incident_id UUID NOT NULL REFERENCES public.gym_safety_incidents(id) ON DELETE RESTRICT`<br>`actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`<br>`action TEXT NOT NULL CHECK (action IN ('created', 'status_change', 'note_added', 'escalated', 'resolved', 'dismissed'))`<br>`previous_status TEXT`<br>`new_status TEXT`<br>`notes TEXT CHECK (char_length(notes) <= 2000)`<br>`created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` |
| **Foreign Key Rule** | **`ON DELETE RESTRICT`**: No parent incident deletion can cascade to destroy historical safety evidence. |
| **Hardened RLS** | **SELECT**: **DENIED to all direct client queries** (`USING (FALSE)`). Retrieval is mediated exclusively via RPC `get_safety_incident_audit_trail()`.<br>**INSERT**: Direct client insert **DENIED** (`WITH CHECK (FALSE)`).<br>**UPDATE**: Direct client update **DENIED** (`USING (FALSE)`).<br>**DELETE**: Direct client delete **DENIED** (`USING (FALSE)`). |
| **Mutation Path** | Appended exclusively within the atomic PostgreSQL transactions of authoritative RPCs. |

### 2.3 Table: `public.gym_emergency_contacts`

| Attribute | Specification |
| :--- | :--- |
| **Table Name** | `public.gym_emergency_contacts` |
| **Purpose** | Stores member next-of-kin emergency contact details for physical medical crises at a gym. |
| **Key Columns** | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`<br>`user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`<br>`contact_name TEXT NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 100)`<br>`relationship TEXT NOT NULL CHECK (char_length(relationship) BETWEEN 2 AND 50)`<br>`phone_number TEXT NOT NULL CHECK (char_length(phone_number) BETWEEN 7 AND 20)`<br>`alternative_phone TEXT CHECK (char_length(alternative_phone) <= 20)`<br>`medical_notes TEXT CHECK (char_length(medical_notes) <= 500)`<br>`created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`CONSTRAINT uq_user_emergency_contact UNIQUE (user_id)` |
| **Hardened RLS** | **SELECT**: Allowed **ONLY** for `user_id = auth.uid()`. Facility owners are **DENIED direct SELECT**.<br>**INSERT**: `WITH CHECK (user_id = auth.uid())`.<br>**UPDATE**: `USING (user_id = auth.uid())`.<br>**DELETE**: `USING (user_id = auth.uid())`. |
| **Owner Access** | Owners retrieve contact **ONLY** via `get_active_member_emergency_contact(p_user_id, p_gym_id)`, which validates an active floor check-in. |
| **Sensitive Field** | `medical_notes` is protected; returned only during verified active floor attendance emergencies. |

### 2.4 Table: `public.gym_safety_notices`

| Attribute | Specification |
| :--- | :--- |
| **Table Name** | `public.gym_safety_notices` |
| **Purpose** | High-visibility hazard warnings, maintenance closures, and floor advisories. |
| **Key Columns** | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`<br>`gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE`<br>`author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`<br>`title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120)`<br>`content TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 2000)`<br>`notice_type TEXT NOT NULL CHECK (notice_type IN ('hazard_warning', 'maintenance_closure', 'safety_guideline', 'emergency_advisory'))`<br>`severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low'))`<br>`affected_area TEXT CHECK (char_length(affected_area) <= 120)`<br>`is_active BOOLEAN DEFAULT TRUE NOT NULL`<br>`starts_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`expires_at TIMESTAMPTZ`<br>`created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`<br>`updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` |
| **Hardened RLS** | **SELECT**: Active members of `gym_id` and verified facility owner.<br>**INSERT/UPDATE/DELETE**: Direct client mutation **DENIED**. Managed via `publish_gym_safety_notice()`. |

### 2.5 Table: `public.gym_emergency_contact_access_logs`

| Attribute | Specification |
| :--- | :--- |
| **Table Name** | `public.gym_emergency_contact_access_logs` |
| **Purpose** | Tamper-proof, immutable audit ledger tracking every lookup of an athlete's sensitive emergency contact and medical data by gym owners. |
| **Key Columns** | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`<br>`gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT`<br>`member_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT`<br>`viewer_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT`<br>`attendance_session_id UUID NOT NULL REFERENCES public.gym_attendance_sessions(id) ON DELETE RESTRICT`<br>`accessed_fields TEXT[] DEFAULT ARRAY['contact_name', 'relationship', 'phone_number', 'alternative_phone', 'medical_notes'] NOT NULL`<br>`accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` |
| **Foreign Key Retention Semantics** | **`ON DELETE RESTRICT` on all 4 parent references**: No parent gym, member, owner, or attendance session deletion may cascade to delete access audit evidence. Audit records survive ordinary parent lifecycle operations and cannot be destroyed. |
| **Hardened RLS** | **SELECT**: Allowed **ONLY** for the subject member (`member_user_id = auth.uid()`) for transparency into who accessed their sensitive records. Facility owners are **DENIED direct SELECT**.<br>**INSERT/UPDATE/DELETE**: Direct client mutation is **STRICTLY DENIED** (`WITH CHECK (FALSE)` / `USING (FALSE)`). |
| **Mutation Path** | Appended atomically and exclusively within `get_active_member_emergency_contact()` upon successful active check-in authorization. |

---

## 3. Authoritative RPC Specifications

### 3.1 `report_gym_safety_incident`
- **Inputs**: `p_gym_id UUID`, `p_category TEXT`, `p_severity TEXT`, `p_title TEXT`, `p_description TEXT`, `p_location TEXT DEFAULT NULL`, `p_reported_user_id UUID DEFAULT NULL`, `p_is_anonymous BOOLEAN DEFAULT FALSE`, `p_trigger_block BOOLEAN DEFAULT FALSE`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**:
  - Caller must have an `active` membership in `p_gym_id`.
  - Rate limit: Rejects if caller submitted > 5 incidents in past 60 minutes (`ERRCODE = 42901`).
  - Self-report check: Rejects if `p_reported_user_id = auth.uid()` (`ERRCODE = 40002`).
- **Execution**:
  - Detects active attendance session: `SELECT id INTO v_sess_id FROM gym_attendance_sessions WHERE user_id = auth.uid() AND gym_id = p_gym_id AND status = 'active' AND check_out_at IS NULL LIMIT 1`.
  - Inserts row into `gym_safety_incidents`.
  - Inserts initial creation row into `gym_safety_incident_logs`.
  - If `p_trigger_block = true` and `p_reported_user_id IS NOT NULL`, inserts row into `gym_buddy_blocks` with `ON CONFLICT DO NOTHING`.
- **Output**: Returns incident ID and confirmation.

### 3.2 `trigger_gym_emergency_sos`
- **Inputs**: `p_location_details TEXT DEFAULT NULL`. (Note: `p_gym_id` is **not supplied by client**; it is derived server-side).
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**: Caller **must** have an active attendance session (`status = 'active' AND check_out_at IS NULL`).
- **Deduplication & Idempotency**:
  - Checks if an open `critical` incident created via SOS already exists for this member within the last 15 minutes.
  - If found: Appends `p_location_details` to existing incident and returns existing ID (prevents alarm flooding).
  - If none: Creates new `critical` incident with category `'medical_emergency'`, title `'EMERGENCY SOS: Floor Assistance Requested'`.
  - Inserts log row into `gym_safety_incident_logs`.
- **Output**: Returns `{ incident_id, alert_status: 'dispatched', gym_id, gym_name }`.

### 3.3 `get_gym_safety_incidents` (Owner Incident Retrieval)
- **Inputs**: `p_gym_id UUID`, `p_status_filter TEXT DEFAULT NULL`, `p_severity_filter TEXT DEFAULT NULL`, `p_limit INT DEFAULT 30`, `p_offset INT DEFAULT 0`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**: Verifies `EXISTS (SELECT 1 FROM gyms WHERE id = p_gym_id AND owner_id = auth.uid())`.
- **Projection & Anonymous Protection**:
  ```sql
  SELECT
      i.id,
      i.gym_id,
      CASE WHEN i.is_anonymous THEN NULL ELSE i.reporter_id END AS reporter_id,
      CASE WHEN i.is_anonymous THEN 'Anonymous Member' ELSE p.display_name END AS reporter_name,
      CASE WHEN i.is_anonymous THEN NULL ELSE p.avatar_url END AS reporter_avatar_url,
      i.is_anonymous,
      i.category,
      i.severity,
      i.title,
      i.description,
      i.location_in_facility,
      i.reported_user_id,
      ru.display_name AS reported_user_name,
      i.attendance_session_id,
      i.status,
      i.resolution_notes,
      i.resolved_at,
      i.created_at,
      i.updated_at
  FROM public.gym_safety_incidents i
  LEFT JOIN public.profiles p ON p.id = i.reporter_id
  LEFT JOIN public.profiles ru ON ru.id = i.reported_user_id
  WHERE i.gym_id = p_gym_id
    AND (p_status_filter IS NULL OR i.status = p_status_filter)
    AND (p_severity_filter IS NULL OR i.severity = p_severity_filter)
  ORDER BY 
    CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END ASC,
    i.created_at DESC
  LIMIT p_limit OFFSET p_offset;
  ```

### 3.4 `get_active_member_emergency_contact`
- **Inputs**: `p_user_id UUID`, `p_gym_id UUID`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**:
  - Verifies caller owns `p_gym_id` (`g.owner_id = auth.uid()`).
  - Verifies `p_user_id` has an **ACTIVE attendance session** at `p_gym_id`:
    `EXISTS (SELECT 1 FROM gym_attendance_sessions WHERE user_id = p_user_id AND gym_id = p_gym_id AND status = 'active' AND check_out_at IS NULL)`.
  - If checked out or non-existent: throws `40303: Member is not currently checked into this facility`.
- **Access Audit Logging**:
  - Atomically appends an immutable row to `public.gym_emergency_contact_access_logs` recording `(gym_id, member_user_id, viewer_owner_id, attendance_session_id, accessed_fields, accessed_at)`.
- **Output**: Returns `{ contact_name, relationship, phone_number, alternative_phone, medical_notes, session_check_in_at }`.

### 3.5 `update_safety_incident_status`
- **Inputs**: `p_incident_id UUID`, `p_new_status TEXT`, `p_resolution_notes TEXT DEFAULT NULL`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**: Caller owns the facility where the incident occurred.
- **State Machine Validation**: Validates transition (`reported` &rarr; `acknowledged` &rarr; `investigating` &rarr; `action_taken` &rarr; `resolved` / `dismissed`). Illegal rollbacks rejected.
- **Side Effect**: Appends to `gym_safety_incident_logs`.

### 3.6 `get_safety_incident_audit_trail`
- **Inputs**: `p_incident_id UUID`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**: Caller owns the facility.
- **Anonymous Whistleblower Privacy**:
  - If `v_incident.is_anonymous` is true and `actor_id = reporter_id`, returns:
    - `actor_id = NULL`
    - `actor_name = 'Anonymous Member'`
    - Profile join is performed on `NULL`, preventing any display name or avatar leakage.
- **Output**: Chronological list of all audit events for that incident.

### 3.7 `publish_gym_safety_notice`
- **Inputs**: `p_gym_id UUID`, `p_title TEXT`, `p_content TEXT`, `p_notice_type TEXT`, `p_severity TEXT`, `p_affected_area TEXT`, `p_expires_at TIMESTAMPTZ`.
- **Security Definer**: Yes (`SET search_path = public, auth`).
- **Authorization**: Caller owns `p_gym_id`.
- **Output**: Confirmation.
