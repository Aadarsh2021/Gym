# Phase G6 — Gym Safety & SPS (Safety & Protection System)
## Forensic R&D Audit & Hardened Architectural Discovery

**Document Version:** 1.1.0 (Hardened)  
**Phase:** G6 — Gym Safety & Protection System (SPS)  
**Status:** HARDENED ARCHITECTURAL SPECIFICATION (NO IMPLEMENTATION CODE)  
**Parent Phases:**  
- Phase C1–C11: Member Gym Integration, Attendance Sessions, & Performance Overlays (Live)  
- Phase G1: Gym Retention Foundation (Live)  
- Phase G2: Gym Community Feed & Content Moderation (Live)  
- Phase G3: Dynamic Gym Buddy Matching & Safety Controls (Live)  
- Phase G4: Personal 1:1 Buddy Chat (Live)  
- Phase G5: Gym Challenges & Gym Leaderboards (Live)  
**Current Production Target:** `https://gymbuddy-da185.web.app`  
**Latest Production Release Commit:** `9f80b00dfafabd8276d8e5235110dc81f3b1f8ca`

---

## 1. Executive Summary

Phase G6 introduces the **Gym Safety & Protection System (SPS)** to FitBoost Gym. Following the initial forensic audit, the architecture has undergone **strict privacy and security hardening**:

1. **Anonymous Whistleblower Protection via RPC-Only Ingress**:
   - Row Level Security (RLS) provides row-level filtering, not column masking. If an owner had direct table `SELECT` on `gym_safety_incidents`, Postgres would expose the `reporter_id` column unless complex views were introduced.
   - **Hardened Architecture**: Direct table `SELECT` on `gym_safety_incidents` is **DENIED to facility owners and reported parties**. Members can SELECT only their own reports (`reporter_id = auth.uid()`).
   - All incident triage by facility owners **must** use the `SECURITY DEFINER` RPC `get_gym_safety_incidents()`. For anonymous reports, `reporter_id` is completely omitted from the RPC projection, making extraction mathematically impossible.
2. **Immutable Append-Only Audit Ledger**:
   - `gym_safety_incident_logs` enforces `ON DELETE RESTRICT` from the parent incident. No cascade or direct modification can ever destroy safety records.
   - Direct `INSERT`, `UPDATE`, and `DELETE` are completely denied for all client roles including owners. Only authoritative PostgreSQL RPC transactions may append log entries.
3. **RPC-Only Emergency Contact Retrieval**:
   - Owners are denied direct table `SELECT` on `gym_emergency_contacts`.
   - Contact retrieval must use `get_active_member_emergency_contact(p_user_id, p_gym_id)`, which dynamically checks that the member is **currently checked into the facility with an active attendance session**. Access immediately revokes upon checkout.
4. **Idempotent Emergency SOS Anchoring**:
   - SOS strictly derives `gym_id` from the member's active `gym_attendance_sessions` row.
   - Rapid SOS calls within a 15-minute window are deduplicated to prevent alarm flooding.

---

## 2. Forensic Repository Audit Summary

Every relevant domain across existing live migrations, tables, services, and routes was forensically audited:

| Keyword / Domain | Live Implementation | Reality & Hardening Need |
| :--- | :--- | :--- |
| **"SPS"** | **0% Implemented** | Proposed as enterprise **Safety & Protection System**. |
| **Physical Safety Incidents** | **0% Implemented** | Zero tables exist. G6 introduces `gym_safety_incidents`. |
| **Audit Ledger** | **0% Implemented** | Existing G2/G3 moderation overwrites status directly. G6 introduces immutable append-only `gym_safety_incident_logs` with `ON DELETE RESTRICT`. |
| **Emergency SOS** | **0% Implemented** | No floor alarm exists. G6 introduces attendance-anchored SOS with 15-minute deduplication window. |
| **Emergency Contacts** | **0% Implemented** | Profiles store zero next-of-kin data. G6 introduces `gym_emergency_contacts` with RPC-only floor lookup. |
| **Community Reports (G2)** | **Live** | `gym_post_reports` flags UGC posts. Unchanged by G6. |
| **Buddy Blocks (G3)** | **Live** | `gym_buddy_blocks` enforces mutual invisibility. G6 integrates automatic blocking when reporting abusive members. |
| **Buddy Reports (G3)** | **Live** | `gym_buddy_reports` handles interpersonal complaints. G6 provides complementary physical safety tracking. |
| **Announcements (G1)** | **Live** | `gym_announcements` handles broadcasts. G6 introduces dedicated high-priority `gym_safety_notices`. |

---

## 3. Technology Stack & Hardened Architectural Boundaries

- **Database**: Supabase PostgreSQL with zero-trust client access.
- **RLS Guard**: Direct mutation (`INSERT`, `UPDATE`, `DELETE`) denied on all 4 new tables.
- **Direct SELECT on Sensitive Tables**:
  - `gym_safety_incidents`: Reporter only. Owner **DENIED**.
  - `gym_safety_incident_logs`: All client roles **DENIED**.
  - `gym_emergency_contacts`: Member owner only (`user_id = auth.uid()`). Owner **DENIED**.
- **Ingress/Egress**: Mediated strictly by 9 `SECURITY DEFINER` stored procedures with `SET search_path = public, auth`.
- **UI & Navigation**: Stationary desktop sidebar (`app-sidebar`) and mobile bottom nav remain 100% untouched.
