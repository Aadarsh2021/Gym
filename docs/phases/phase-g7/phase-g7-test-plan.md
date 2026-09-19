# Phase G7: Comprehensive Test & Quality Assurance Plan

## 1. Test Suite Architecture

Phase G7 test coverage spans three primary tiers:
1. **Database & Stored Procedure Tests (`tests/security/g7-dashboard-security.test.ts`)**:
   - Multi-tenant boundary enforcement.
   - Caller authentication and authorization checks (`40100`, `40301`).
   - Timezone boundary accuracy across calendar transitions.
   - Privacy firewalls (G6 whistleblower masking, G4 chat air-gap, emergency contact exclusion).
2. **Service & Domain Unit Tests (`tests/unit/owner-operations-intelligence.test.ts`)**:
   - Mathematical precision of metric aggregations (occupancy, streaks, average visit duration, peak hours).
   - Graceful null/empty handling for newly created gyms with zero sessions.
   - Data mapping into strongly typed client domain objects.
3. **Regression Assurance**:
   - Total regression test baseline: **787 / 787 passing tests across 68 test files**.

---

## 2. Detailed Test Cases

### 2.1 Multi-Tenant Security & Access Control
- **`SEC-G7-01: Anonymous Caller Rejection`**:
  - *Action*: Invoke `get_owner_dashboard_overview` with unauthenticated role.
  - *Expected*: Throws SQLSTATE `40100` (`Authentication required`).
- **`SEC-G7-02: Member Access Rejection`**:
  - *Action*: Call RPC with an authenticated member token who does not own the gym.
  - *Expected*: Throws SQLSTATE `40301` (`Unauthorized: Caller is not the verified owner of this facility`).
- **`SEC-G7-03: Cross-Gym Owner Lockout`**:
  - *Action*: Owner A (owns Gym A) calls RPC passing `p_gym_id = Gym B`.
  - *Expected*: Throws SQLSTATE `40301`. Zero leakage of Gym B metrics.
- **`SEC-G7-04: Platform Admin Access`**:
  - *Action*: Authenticated user with `role = 'platform_admin'` calls RPC for any gym.
  - *Expected*: Succeeds with `200 OK` and returns authorized metrics.

### 2.2 Metric Calculation Precision
- **`MET-G7-01: Live Occupancy Accuracy`**:
  - *Setup*: 3 active attendance sessions, 5 completed sessions.
  - *Expected*: `live_occupancy = 3`.
- **`MET-G7-02: Today's Completed Visits & Duration Mean`**:
  - *Setup*: Completed sessions of 30 mins, 60 mins, and 90 mins today.
  - *Expected*: `today_completed_visits = 3`, `today_avg_duration_minutes = 60.0`.
- **`MET-G7-03: Zero-Session Empty Gym Handling`**:
  - *Setup*: Brand new gym with zero members and zero sessions.
  - *Expected*: All counts return `0`, `today_avg_duration_minutes = 0.0`, all 24 peak hours return `{ hour: H, count: 0 }`.
- **`MET-G7-04: Peak Hours Bucket Distribution`**:
  - *Setup*: 2 check-ins at 07:15, 1 check-in at 07:45, 3 check-ins at 18:30 local facility time.
  - *Expected*: Hour 7 count is `3`, Hour 18 count is `3`, other hours return `0`.

### 2.3 Timezone Boundary Precision
- **`TZ-G7-01: Facility Midnight Windowing`**:
  - *Setup*: Gym registered with `timezone = 'Asia/Kolkata'`.
  - *Session A*: Checked in at 23:45 IST (18:15 UTC previous day).
  - *Session B*: Checked in at 00:15 IST (18:45 UTC current day).
  - *Expected*: Session A is counted towards yesterday's check-ins; Session B is counted towards today's check-ins.
- **`TZ-G7-02: Independence from Client Clock`**:
  - *Action*: Call RPC from a client device set to New York or London time.
  - *Expected*: PostgreSQL evaluates day boundaries using the facility's stored timezone, regardless of client time.

### 2.4 Privacy & Whistleblower Protections
- **`PRIV-G7-01: Whistleblower Anonymity Preservation`**:
  - *Setup*: 1 anonymous physical safety report and 1 identified report filed in Gym A.
  - *Expected*: `open_safety_incidents_count = 2`. Zero reporter UUIDs, names, or individual incident records appear in the response payload.
- **`PRIV-G7-02: G4 Peer Chat Air-Gap`**:
  - *Setup*: Multiple active 1:1 buddy chat messages sent between athletes.
  - *Expected*: Zero chat message counts, user IDs, or text fragments exist anywhere in the dashboard payload.
- **`PRIV-G7-03: Emergency Contact Exclusion`**:
  - *Setup*: Athletes have saved emergency contact names, phones, and medical notes.
  - *Expected*: Zero emergency contact fields are exposed in the dashboard payload.

---

## 3. Regression Baseline

The test execution must preserve:
- Total existing test files: **68 files**
- Total passing tests: **787 tests**
- New G7 tests will be added cleanly into dedicated test files (`tests/unit/owner-operations-intelligence.test.ts` and `tests/security/g7-dashboard-security.test.ts`) without modifying existing test fixtures.
