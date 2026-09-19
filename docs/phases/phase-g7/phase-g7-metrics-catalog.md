# FitBoost Phase G7: Operations Intelligence Metrics Catalog

This document defines the mathematical, temporal, multi-tenant, and authorization contracts for all metrics surfaced in the Phase G7 Gym Owner Operations Intelligence Dashboard.

---

## 1. Top-Level Operational Metrics

### 1.1 `current_occupancy`
* **Definition**: Number of members physically present in the facility with an ongoing, active attendance visit.
* **Population**: All attendance sessions for `p_gym_id`.
* **Time Window**: Instantaneous ($t = \text{now}$).
* **Timezone**: Irrelevant (state-based).
* **Data Source**: `public.gym_attendance_sessions`
* **Aggregation**: 
  $$\sum [s \in \text{gym\_attendance\_sessions} \mid s.\text{gym\_id} = p\_gym\_id \land s.\text{status} = 'active' \land s.\text{check\_out\_at IS NULL}]$$
* **Null/Empty Behavior**: Returns `0` if no active sessions exist.
* **Authorization Boundary**: Requires caller `auth.uid() = gyms.owner_id`.
* **Refresh Frequency**: 20s–30s.

### 1.2 `max_capacity`
* **Definition**: Maximum configured capacity of the gym facility.
* **Population**: Single facility scalar.
* **Data Source**: `public.gyms.max_capacity`
* **Aggregation**: Scalar lookup `COALESCE(g.max_capacity, 100)`.
* **Null/Empty Behavior**: Defaults to `100`.

### 1.3 `occupancy_rate`
* **Definition**: Percentage of current facility capacity in use.
* **Formula**:
  $$\min\left(100.0, \frac{\text{current\_occupancy}}{\max(1, \text{max\_capacity})} \times 100.0\right)$$
* **Null/Empty Behavior**: Returns `0.0` if `current_occupancy = 0`.

---

## 2. Daily Attendance Intelligence

### 2.1 `today_checkins`
* **Definition**: Total number of attendance check-in events initiated during the facility's local calendar day.
* **Population**: Attendance sessions for `p_gym_id`.
* **Time Window**: $[D_{\text{today\_start}}, D_{\text{today\_end}})$ where:
  $$D_{\text{today\_start}} = \text{date\_trunc}('day', \text{timezone}(v\_tz, \text{now}())) \text{ AT TIME ZONE } v\_tz$$
  $$D_{\text{today\_end}} = D_{\text{today\_start}} + \text{interval '1 day'}$$
* **Timezone**: Facility timezone ($v\_tz = \text{gyms.timezone}$).
* **Data Source**: `public.gym_attendance_sessions`
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{check\_in\_at} \ge D_{\text{today\_start}} \land \text{check\_in\_at} < D_{\text{today\_end}}$$
* **Null/Empty Behavior**: Returns `0`.

### 2.2 `today_completed_visits`
* **Definition**: Total visits initiated today that have checked out.
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{check\_in\_at} \ge D_{\text{today\_start}} \land \text{check\_in\_at} < D_{\text{today\_end}} \land \text{check\_out\_at IS NOT NULL}$$

### 2.3 `today_avg_duration_minutes`
* **Definition**: Average visit duration in minutes for completed visits today.
* **Aggregation**:
  $$\text{COALESCE}(\text{ROUND}(\text{AVG}(\text{duration\_seconds}) / 60.0, 1), 0.0)$$
  for completed visits today. Returns `0.0` if no visits completed.

---

## 3. Member Retention & Health

### 3.1 `active_members_30d`
* **Definition**: Distinct members with an active/approved gym membership who have checked in $\ge 1$ time in the trailing 30 facility-local days.
* **Time Window**: $[D_{\text{today\_start}} - \text{interval '29 days'}, D_{\text{today\_end}})$.
* **Data Source**: `public.gym_memberships` JOIN `public.gym_attendance_sessions`
* **Aggregation**:
  $$\text{COUNT}(\text{DISTINCT } m.\text{user\_id}) \text{ WHERE } m.\text{gym\_id} = p\_gym\_id \land m.\text{status} = 'active' \land s.\text{check\_in\_at} \ge (D_{\text{today\_start}} - \text{interval '29 days'})$$

### 3.2 `streak_members_count`
* **Definition**: Members from the active population whose current attendance streak is $\ge 3$ consecutive facility-local calendar days.
* **Data Source**: `public.gym_attendance_streaks`
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{current\_streak} \ge 3$$

### 3.3 `retention_health_percentage`
* **Definition**: Percentage of 30-day active members maintaining an active $\ge 3$ day streak.
* **Formula**:
  $$\text{CASE WHEN active\_members\_30d} > 0 \text{ THEN ROUND}((\text{streak\_members\_count}::NUMERIC / \text{active\_members\_30d}::NUMERIC) \times 100.0, 1) \text{ ELSE } 0.0 \text{ END}$$

### 3.4 `pending_memberships_count`
* **Definition**: Members who have submitted join requests pending owner approval.
* **Data Source**: `public.gym_memberships`
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{status} = 'pending'$$

---

## 4. Community & Subsystem Engagement

### 4.1 `moderation_flags_count` (G2 Unresolved Moderation)
* **Authoritative Source**: `public.gym_post_reports`
* **Filter**: `WHERE gym_id = p_gym_id AND status = 'pending'`
* **Rationale**: `gym_post_reports` is the authoritative dispute queue. Unresolved work is strictly where `status = 'pending'`. Does not count already-reviewed or dismissed content.
* **Aggregation**:
  $$\text{COUNT}(*) \text{ FROM public.gym\_post\_reports WHERE gym\_id} = p\_gym\_id \land \text{status} = 'pending'$$

### 4.2 `active_buddy_connections_count` (G3 Buddy Matching)
* **Authoritative Source**: `public.gym_buddy_connections`
* **Filter**: `WHERE gym_id = p_gym_id AND status = 'accepted'`
* **Rationale**: Represents mutual accepted peer training partnerships within this facility.
* **Aggregation**:
  $$\text{COUNT}(*) \text{ FROM public.gym\_buddy\_connections WHERE gym\_id} = p\_gym\_id \land \text{status} = 'accepted'$$

### 4.3 `active_challenges_count` & `challenge_participants_count` (G5)
* **Authoritative Source**: `public.gym_challenges` and `public.gym_challenge_participants`
* **Aggregation**:
  - `active_challenges_count`: `COUNT(*) FROM public.gym_challenges WHERE gym_id = p_gym_id AND status = 'active'`
  - `challenge_participants_count`: `COUNT(DISTINCT user_id) FROM public.gym_challenge_participants WHERE gym_id = p_gym_id AND status = 'active'`

---

## 5. Safety & Compliance Intelligence (G6)

### 5.1 `open_safety_incidents_count`
* **Authoritative Source**: `public.gym_safety_incidents`
* **Authoritative Status Lifecycle**: `reported`, `acknowledged`, `investigating`, `action_taken`, `resolved`, `dismissed`.
* **Filter**: Open statuses requiring owner operational action:
  $$\text{status IN ('reported', 'acknowledged', 'investigating', 'action_taken')}$$
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{status IN ('reported', 'acknowledged', 'investigating', 'action_taken')}$$

### 5.2 `critical_safety_incidents_count`
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{severity} = 'critical' \land \text{status IN ('reported', 'acknowledged', 'investigating', 'action_taken')}$$

### 5.3 `active_safety_notices_count`
* **Authoritative Source**: `public.gym_safety_notices`
* **Filter**: `is_active = TRUE AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())`
* **Aggregation**:
  $$\text{COUNT}(*) \text{ WHERE gym\_id} = p\_gym\_id \land \text{is\_active} = \text{TRUE} \land \text{starts\_at} \le \text{NOW}() \land (\text{expires\_at IS NULL} \lor \text{expires\_at} > \text{NOW}())$$

---

## 6. Utilization Intelligence: Peak Hours Distribution

### 6.1 `peak_hours_distribution`
* **Display Label**: "Check-in Distribution — Last 7 Days"
* **Definition**: Total count of check-ins across the past 7 facility-local calendar days partitioned into exactly 24 facility-local hourly buckets $[0..23]$.
* **Time Window**: Trailing 7 facility-local calendar days $[D_{\text{today\_start}} - \text{interval '6 days'}, D_{\text{today\_end}})$.
* **Bucket Formula**:
  $$\text{bucket\_hour} = \text{EXTRACT}(\text{HOUR FROM timezone}(v\_tz, \text{check\_in\_at}))::\text{INT}$$
* **Output**: Array of 24 objects `[{ hour: 0, checkins: N }, ..., { hour: 23, checkins: M }]`.
