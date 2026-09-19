# ADR-004: Emergency Contact Access Logging & Whistleblower Audit Masking

**Status:** Approved & Implemented  
**Date:** September 19, 2026  
**Context:** Phase G6 — Gym Safety / SPS  

## Problem
1. **Whistleblower Audit De-anonymization**: Even if `gym_safety_incidents` masks `reporter_id` for anonymous reports in `get_gym_safety_incidents()`, the audit trail ledger (`gym_safety_incident_logs`) records the initial report submission event with `actor_id = reporter_id`. If an owner inspects the audit trail via `get_safety_incident_audit_trail()`, naive projection or joins on `profiles` would expose the anonymous whistleblower's user ID and display name.
2. **Unaccountable Emergency Contact Harvesting**: Storing sensitive emergency contacts and medical notes requires an audit trail whenever a gym owner inspects an athlete's next-of-kin. Reusing `gym_safety_incident_logs` would require a non-null `incident_id`, leading to invalid synthetic/fake incidents.

## Decision
1. **Dedicated Emergency Contact Access Audit Ledger**:
   - Create `public.gym_emergency_contact_access_logs`:
     - Columns: `id UUID PK`, `gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT`, `member_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT`, `viewer_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT`, `attendance_session_id UUID NOT NULL REFERENCES public.gym_attendance_sessions(id) ON DELETE RESTRICT`, `accessed_fields TEXT[] NOT NULL`, `accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - **Foreign Key Retention Semantics**: `ON DELETE RESTRICT` is enforced across all four referenced entities to prevent accidental or malicious cascading deletion of audit evidence upon gym closure, member deactivation, or session archival. Historical records survive parent lifecycle operations.
   - Direct client `INSERT`, `UPDATE`, and `DELETE` are denied via RLS `WITH CHECK (FALSE)` / `USING (FALSE)`.
   - Direct `SELECT` is restricted to the athlete (`member_user_id = auth.uid()`) to allow members to audit who viewed their emergency details.
   - The RPC `public.get_active_member_emergency_contact()` atomically appends an audit row inside the same database transaction upon verifying active check-in authorization.
   - If the member is checked out or cross-gym lookup is attempted, authorization fails and zero audit rows are appended.
2. **Anonymous Reporter Audit Trail Masking**:
   - In `public.get_safety_incident_audit_trail()`, check parent incident's `is_anonymous` flag.
   - For all log entries where `v_incident.is_anonymous = true` AND `l.actor_id = v_incident.reporter_id`:
     - `actor_id` is projected as `NULL`.
     - `actor_name` is projected as `'Anonymous Member'`.
     - The profile `LEFT JOIN` evaluates against `NULL` (`ON (CASE WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN NULL ELSE l.actor_id END) = p.id`), preventing any profile table lookup or display name leakage.
   - Direct client `SELECT` on `gym_safety_incident_logs` remains completely denied via RLS `USING (FALSE)`.

## Consequences
- **Positive**: Complete privacy guarantees for whistleblowers throughout incident lifecycle and audit reviews; full non-repudiation and accountability for emergency contact lookups without synthetic incident artifacts.
- **Verification**: Fully verified by security suites `g6-reporter-privacy.test.ts` and `g6-emergency-sos-security.test.ts`.
