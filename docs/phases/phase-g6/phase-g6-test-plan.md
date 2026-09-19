# Phase G6 — Gym Safety & SPS
## Hardened Test & Verification Plan

**Document Version:** 1.1.0 (Hardened)  
**Target Coverage:** Unit, Domain, Security, Zero-Trust RLS, Audit Immutability, Privacy Proving, Abuse Defense, and G1–G5 Regression  

---

## 1. Test Architecture Overview

```
tests/
├── unit/
│   ├── gym-safety.test.ts                 # Domain models, severity taxonomy, state machine transitions (12 tests)
│   └── emergency-contact.test.ts          # Contact formatting, phone validation, medical notes handling (6 tests)
├── security/
│   ├── g6-safety-rls.test.ts              # Direct client mutation denial, zero-trust owner table lockouts (14 tests)
│   ├── g6-reporter-privacy.test.ts        # Comprehensive owner deanonymization prevention proofs (10 tests)
│   ├── g6-audit-immutability.test.ts      # Immutability, update/delete rejection, ON DELETE RESTRICT (8 tests)
│   ├── g6-emergency-contact-security.test.ts # RPC-only access, active check-in requirement, checkout revocation (10 tests)
│   ├── g6-emergency-sos.test.ts           # Server-derived gym_id, 15-min deduplication, remote denial (8 tests)
│   └── g6-abuse-prevention.test.ts        # Rate limiting (5/hr), self-reporting prevention, XSS escaping (8 tests)
```

---

## 2. Detailed Test Specifications

### 2.1 Security & RLS Zero-Trust Tests (`tests/security/g6-safety-rls.test.ts`)
1. **`SEC-G6-01: Direct Client INSERT Denial on Incidents`**: Direct `INSERT` on `gym_safety_incidents` by anonymous or authenticated users fails with `42501` RLS violation.
2. **`SEC-G6-02: Direct Client UPDATE Denial on Incidents`**: Direct `UPDATE` on `gym_safety_incidents` affects 0 rows / fails with RLS violation.
3. **`SEC-G6-03: Direct Client DELETE Denial on Incidents`**: Direct `DELETE` on `gym_safety_incidents` fails with RLS violation (evidence preservation).
4. **`SEC-G6-04: Facility Owner Direct SELECT Denial`**: Direct `SELECT` on `gym_safety_incidents` by a verified facility owner returns 0 rows (owner is forced to use the RPC).
5. **`SEC-G6-05: Direct Client All-Deny on Audit Logs`**: Direct `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `gym_safety_incident_logs` fail with `42501`.
6. **`SEC-G6-06: Direct Owner SELECT Denial on Emergency Contacts`**: Direct `SELECT` on `gym_emergency_contacts` by a facility owner returns 0 rows.
7. **`SEC-G6-07: Member Direct SELECT on Own Emergency Contact`**: Member can query their own emergency contact record (`user_id = auth.uid()`).
8. **`SEC-G6-08: Cross-Gym Safety Notice Isolation`**: Member of Gym A cannot view safety notices published by Gym B.

### 2.2 Anonymous Reporter Privacy Defense Tests (`tests/security/g6-reporter-privacy.test.ts`)
9. **`PRIV-G6-01: Owner Direct SELECT Returns Zero Rows`**: Proves owner cannot query table to read `reporter_id` column directly.
10. **`PRIV-G6-02: RPC Response Omits Reporter ID for Anonymous Reports`**: Owner calls `get_gym_safety_incidents()`. For an anonymous incident, `reporter_id` is strictly `null` and `reporter_name` is `'Anonymous Member'`.
11. **`PRIV-G6-03: PostgREST Filter Probing Yields Zero Rows`**: Owner attempts to filter `/gym_safety_incidents?reporter_id=eq.<uuid>` or order by `reporter_id`. Query returns 0 rows (table RLS blocks evaluation).
12. **`PRIV-G6-04: Reported Party Absolute Invisibility`**: Accused member named in an incident queries the database via PostgREST or RPC. Gets 0 rows and zero knowledge of the complaint.
13. **`PRIV-G6-05: Database Constraint Errors Reveal No IDs`**: Calling RPCs with invalid arguments returns clean error messages without leaking victim or reporter UUIDs.
14. **`PRIV-G6-06: Member Reads Own Report Status`**: The whistleblower can call `get_my_gym_safety_incidents()` and see current status (`investigating`, `resolved`) and resolution notes without exposing their identity to others.
15. **`PRIV-G6-07: Owner Audit RPC Masks Anonymous Reporter Actor ID`**: For anonymous reports, `get_safety_incident_audit_trail()` returns `actor_id = null`, `actor_name = 'Anonymous Member'`, joins profile on `NULL`, and reveals zero reporter UUIDs.
16. **`PRIV-G6-08: PostgREST/Direct Table Probing on Incident Logs Denied`**: Direct SELECT on `gym_safety_incident_logs` fails with `42501`, preventing raw `actor_id` extraction.

### 2.3 Audit Ledger Immutability Tests (`tests/security/g6-audit-immutability.test.ts`)
17. **`AUDIT-G6-01: Attempted Log Modification Fails`**: Executing `UPDATE gym_safety_incident_logs SET notes = 'tampered'` fails with RLS `42501`.
18. **`AUDIT-G6-02: Attempted Log Deletion Fails`**: Executing `DELETE FROM gym_safety_incident_logs` fails with RLS `42501`.
19. **`AUDIT-G6-03: ON DELETE RESTRICT Prevents Incident Deletion`**: Attempting to delete a safety incident that has log entries throws foreign key restriction error (`23503`).
20. **`AUDIT-G6-04: Authoritative State Transition Logging`**: Calling `update_safety_incident_status()` automatically appends an immutable log row containing `actor_id`, `previous_status`, `new_status`, and `notes`.
21. **`AUDIT-G6-05: Owner Retrieves Incident Audit Trail via RPC`**: Owner calling `get_safety_incident_audit_trail()` receives chronological event history.

### 2.4 Emergency Contact Security & Privacy Tests (`tests/security/g6-emergency-contact-security.test.ts`)
22. **`EMG-G6-01: Owner RPC Lookup During Active Check-in`**: When Member A has an active attendance session at Gym 1, Owner of Gym 1 calls `get_active_member_emergency_contact(A, Gym 1)` and receives contact details.
23. **`EMG-G6-02: Immediate Access Revocation Upon Checkout`**: Member A checks out of Gym 1. Owner calls `get_active_member_emergency_contact(A, Gym 1)`. Call is rejected with `40303: Member is not currently checked into this facility`.
24. **`EMG-G6-03: Cross-Gym Emergency Contact Access Denied`**: Member A is checked into Gym 1. Owner of Gym 2 attempts lookup via RPC. Call is rejected with `40301 Unauthorized`.
25. **`EMG-G6-04: Medical Notes Excluded from Broad Queries`**: Sensitive `medical_notes` field is never returned in member discovery, rosters, or general user queries.
26. **`EMG-G6-05: Successful Active Check-in Lookup Appends Access Audit Log`**: Exactly 1 record created in `gym_emergency_contact_access_logs` containing viewer owner, target member, gym, and session ID.
27. **`EMG-G6-06: Post-Checkout & Cross-Gym Lookups Create Zero Audit Logs`**: No access log is appended on authorization failure.
28. **`EMG-G6-07: Direct Client Mutations on Emergency Access Logs Strictly Denied`**: Member and owner cannot INSERT, UPDATE, or DELETE access logs.
29. **`EMG-G6-08: ON DELETE RESTRICT Prevents Cascading Access Log Deletion`**: Attempting to delete gym, member user, viewer owner, or attendance session throws `23503: foreign_key_violation`, preserving audit records.

### 2.5 Emergency SOS Tests (`tests/security/g6-emergency-sos.test.ts`)
30. **`SOS-G6-01: SOS Requires Active Floor Attendance`**: Calling `trigger_gym_emergency_sos()` without an active check-in throws `40302`.
31. **`SOS-G6-02: Gym ID Derived Server-Side`**: Client cannot supply a foreign gym ID; `gym_id` is derived from the active check-in session.
32. **`SOS-G6-03: 15-Minute SOS Deduplication`**: Calling SOS twice in 30 seconds creates exactly 1 incident record in `gym_safety_incidents` (appends location notes to existing incident).

### 2.6 Abuse Prevention & Rate Limiting Tests (`tests/security/g6-abuse-prevention.test.ts`)
33. **`ABUSE-G6-01: 5 Reports Per Hour Rate Limit`**: 6th report within 60 minutes fails with `42901`.
34. **`ABUSE-G6-02: Self-Reporting Denied`**: Attempting to report self fails with `40002`.
35. **`ABUSE-G6-03: Integrated Safety Block Execution`**: When `p_trigger_block = true`, a corresponding row in `gym_buddy_blocks` is created automatically.
36. **`ABUSE-G6-04: XSS Payload Safety`**: Script tags in title, description, or notes are stored as literal strings and rendered escaped in JSX.

### 2.7 Full Regression Gate
31. **`REG-G6-01: All 731 Existing Tests Pass`**: Vitest regression suite 100% green.
32. **`REG-G6-02: TypeScript Compilation Clean`**: `tsc --noEmit` exits with 0 errors.
33. **`REG-G6-03: Secret Audit Clean`**: `node scripts/audit-secrets.js` exits with 0 violations.
