# FitBoost Product Requirements Document (PRD)
## Phase G7: Gym Owner Dashboard & Operations Intelligence

---

## 1. Executive Summary
Phase G7 upgrades the existing `/owner/dashboard` view into a unified, high-performance **Gym Operations Intelligence Dashboard**. Rather than a basic attendance ledger, G7 surfaces real-time facility occupancy, longitudinal attendance intelligence, member retention health, proactive operational action alerts, subsystem engagement snapshots, and preserved floor management.

---

## 2. Core Principles
1. **Zero Domain Duplication**: G7 is strictly an aggregate read layer over authoritative G1–G6 data.
2. **Facility Timezone Authority**: All daily and hourly calculations are evaluated against `gyms.timezone`, never browser client time.
3. **Ironclad Privacy Firewall**: Zero inspection of G4 peer chat, zero exposure of G6 anonymous reporter identities, and zero leakage of medical or emergency contact data.
4. **Single-Roundtrip RPC**: All overview metrics are aggregated in PostgreSQL memory through `get_owner_dashboard_overview(p_gym_id)`.

---

## 3. Product Features & Information Architecture

### 3.1 Facility Header
- Facility name, max capacity, local timezone indicator.
- Facility operational status badge (`Normal`, `Crowded`, `At Capacity`).
- Last refreshed timestamp ("Last updated 20:30 IST").
- Manual "Refresh" button.

### 3.2 Operational Action Hub
Appears conditionally whenever any of the following items are $> 0$:
- **Pending Members**: `X pending applications` &rarr; links to `/owner/members?status=pending`.
- **Community Moderation**: `Y flagged reports` &rarr; links to `/owner/community?filter=pending`.
- **Safety Incidents**: `Z open incidents` &rarr; links to `/owner/safety`.
- **Critical SPS Alerts**: Highlighted red badge when `critical_safety_incidents_count > 0`.

### 3.3 Top-Level KPI Strip (4 Cards)
1. **Live Occupancy**: Current active count / Max capacity + Occupancy rate percentage bar.
2. **Today's Check-ins**: Total visits started today in facility timezone.
3. **Active Members (30d)**: Distinct active members with visits in the trailing 30 days.
4. **Retention Health**: Percentage of 30d active members on a 3+ day streak.

### 3.4 Utilization & Peak Hours
- **Check-in Distribution — Last 7 Days**: 24 local-hour distribution bar chart $[0..23]$ showing when the facility experiences peak rush.

### 3.5 Subsystem Snapshots
- **Challenges**: Active challenges count & participating members count.
- **Buddy Matching**: Active accepted buddy pairs in facility.
- **Safety & Compliance**: Active safety notices & open incident count.

### 3.6 Preserved Floor Operations (Tabs)
- **Live Floor Tab**: Real-time list of members currently checked in with active session timer, manual checkout button, and 20s polling.
- **Ledger Tab**: Historical completed attendance records with search, date filter, and pagination.
