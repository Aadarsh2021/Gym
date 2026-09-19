# Phase G6 — Gym Safety & SPS (Safety & Protection System)
## Hardened Product Requirements Document (PRD)

**Document Version:** 1.1.0 (Hardened)  
**Status:** APPROVED PRODUCT SCOPE — READY FOR IMPLEMENTATION PLANNING  
**Author:** DeepMind Antigravity Pair Programmer  

---

## 1. Product Decisions Recorded & Locked

1. **Emergency Contact Optionality**:
   - Storing an Emergency Contact is **OPTIONAL**.
   - Members receive a gentle, one-time contextual prompt during their first active gym QR check-in or when opening `/app/gym/safety`, with an option to dismiss or complete later.
2. **Anonymous Reporting Workflow**:
   - Anonymous reports use **Status Tracking + Resolution Notes**.
   - Members can track investigation progress (`reported` &rarr; `investigating` &rarr; `resolved`) and read owner resolution notes on their private "My Reports" tab.
   - The reporter's identity is **never** exposed to facility owners, staff, or reported parties.
3. **Safety Notice Banner Placement**:
   - High-severity floor advisories (`critical` and `high`) appear:
     a) Pinned prominently at the top of the Member Gym Hub (`/app/gym`).
     b) As a dismissible warning banner inside the Active Workout View (`/app/workouts/active`) while checked into that facility.

---

## 2. Core Functional Requirements

### 2.1 Feature 1: Member Safety Incident & Hazard Reporting
- **Scope**: Reporting of physical hazards (`equipment_hazard`, `facility_hazard`, `medical_emergency`, `member_harassment`, `theft_security`, `sanitation_hygiene`, `other`).
- **Severity Levels**: `critical` (immediate floor hazard), `high` (severe equipment flaw), `medium` (standard hazard), `low` (maintenance issue).
- **Privacy Toggle**: Member explicitly selects Identified or Anonymous Whistleblower mode.
- **Integrated Buddy Block**: If the incident involves another member, the member can check "Also Block Member" to instantly insert an active row into `public.gym_buddy_blocks`.
- **Status Visibility**: Members can view a chronological list of their own submitted reports via `get_my_gym_safety_incidents()`.

### 2.2 Feature 2: Floor Emergency SOS Alert
- **Prerequisite**: Member **must** have an active check-in session (`gym_attendance_sessions`) at the facility.
- **Gym ID Derivation**: The server **derives** `gym_id` from the active attendance session rather than trusting client input.
- **Idempotency & Deduplication**: If an athlete or bystander triggers SOS multiple times in rapid succession, calls within a 15-minute emergency window update the existing open SOS incident rather than creating duplicate critical alarms.
- **Rate Limiting**: Maximum 3 SOS dispatches per active session to prevent abuse.

### 2.3 Feature 3: Emergency Contacts & Staff Medical Retrieval
- **Member Management**: Athlete manages Contact Name, Relationship, Phone, Alternative Phone, and optional sensitive Medical Notes.
- **RPC-Only Owner Access**: Owners cannot run direct table queries. When an emergency occurs, staff call `get_active_member_emergency_contact(p_user_id, p_gym_id)`.
- **Dynamic Revocation**: The RPC verifies that the athlete has an active `gym_attendance_sessions` row at that specific facility. Once the athlete checks out, owner read access is immediately denied.

### 2.4 Feature 4: Owner Safety Operations Console (`/owner/safety`)
- **Queue Management**: Filterable by status (`reported`, `acknowledged`, `investigating`, `action_taken`, `resolved`, `dismissed`) and severity (`critical`, `high`, `medium`, `low`).
- **Anonymous Protection Invariant**: Anonymous reports render `reporter_id: null` and `"Anonymous Member"`.
- **State Machine Enforcement**: State transitions are strictly validated. Reopening a resolved or dismissed incident is prohibited.
- **Immutable Audit Trail**: Every status change or investigation note appends an immutable record to `gym_safety_incident_logs`.

### 2.5 Feature 5: Facility Safety Floor Notices
- **Creation**: Owners can publish safety advisories (`hazard_warning`, `maintenance_closure`, `safety_guideline`, `emergency_advisory`).
- **Member Delivery**: Displayed on Gym Hub (`/app/gym`) and during active workouts for checked-in athletes.

---

## 3. Explicitly Out-of-Scope Items

1. **Automatic Municipal Emergency Dispatch (911/112)**: Physical aid and ambulance dispatch remain the operational responsibility of on-site staff.
2. **Third-Party SMS Gateways (Twilio)**: Real-time alerting operates through in-app database notifications and UI polling.
3. **Hardware Panic Buttons / IoT Sensors**: System is 100% software-based.
