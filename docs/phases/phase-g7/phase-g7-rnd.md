# Phase G7: Research & Discovery — Gym Owner Operations Intelligence & Dashboard

## 1. Executive Summary & Context

FitBoost has achieved high operational fidelity across Member Gym Integration (C1–C11) and Facility Operating System modules (G1–G6):
- **G1**: Authoritative Attendance Streaks, Announcements, and Rewards Ledger.
- **G2**: Community Feed, Content Moderation, and Report Resolution.
- **G3**: Dynamic Buddy Matching, Schedule Preferences, and Mutual Compatibility.
- **G4**: Private 1:1 Peer-to-Peer Buddy Chat with strict participant-only isolation.
- **G5**: Facility Challenges and Public Multi-Metric Leaderboards.
- **G6**: Gym Safety & SPS (Physical Hazard Reporting, Anonymous Whistleblower Protection, Emergency SOS Panic Trigger, Check-in Anchored Emergency Contact Access Audit, and High-Priority Floor Notices).

While each subsystem provides its own isolated owner console (`/owner/members`, `/owner/community`, `/owner/challenges`, `/owner/safety`, `/owner/announcements`, `/owner/rewards`), the current primary landing route (`/owner/dashboard`) remains narrowly focused on live floor check-ins and completed session ledger tables implemented in Phase C7.

**Phase G7 transforms `/owner/dashboard` into an Authoritative Operations Intelligence Center**, unifying live facility occupancy, operational attention items, member lifecycle metrics, retention signals, and subsystem engagement without violating existing multi-tenant boundaries or leaking confidential member data.

---

## 2. Forensic Audit of Existing Capabilities

### 2.1 Current Owner Dashboard (`src/features/owner/OwnerDashboardView.tsx`)
A forensic inspection of `OwnerDashboardView.tsx` reveals the following:
- **Two Tab Layout**:
  - `floor`: Displays active attendance sessions (`status = 'active'`) with real-time elapsed duration timers (updated via a 30s client interval) and an emergency contact lookup trigger.
  - `ledger`: Displays paginated completed attendance sessions with date range filters, search, and CSV export capability.
- **Current Top KPI Cards**:
  - *On the Floor Now*: Counts live sessions (`activeSessions.length`).
  - *Today's Check-ins*: Counts sessions initiated within the local day window (`fetchGymTodayCheckinsCount`).
  - *Active Members*: Counts memberships with `status = 'active'` (`fetchGymMemberCounts`).
- **Polling & Refresh Mechanism**:
  - Polls `ownerDashboardService.getFloorSync(activeGym.id)` every 20 seconds.
  - Fires 3 parallel database/storage queries: `fetchGymActiveAttendance()`, `fetchGymTodayCheckinsCount()`, and `fetchGymMemberCounts()`.

### 2.2 Live Authoritative Tables & Schemas
| Subsystem | Authoritative Tables | Authoritative Fields for G7 |
| :--- | :--- | :--- |
| **Facility Core** | `public.gyms` | `id`, `name`, `timezone`, `owner_id`, `capacity_limit` |
| **Memberships (G1)** | `public.gym_memberships` | `status` (`active`, `pending`, `frozen`, `inactive`), `created_at` |
| **Attendance (C4/C5)** | `public.gym_attendance_sessions` | `status` (`active`, `completed`), `check_in_at`, `check_out_at`, `duration_seconds` |
| **Retention (G1)** | `public.gym_attendance_streaks` | `current_streak`, `longest_streak`, `last_visit_date`, `total_visit_days` |
| **Announcements (G1)** | `public.gym_announcements` | `priority`, `is_pinned`, `status`, `created_at`, `expires_at` |
| **Rewards (G1)** | `public.gym_rewards`, `public.gym_reward_redemptions` | `status`, `redeemed_at` |
| **Community (G2)** | `public.gym_posts`, `public.gym_post_reports` | `status` (`published`, `hidden`, `removed`), `created_at` |
| **Buddy Matching (G3)**| `public.gym_buddy_preferences`, `public.gym_buddy_connections` | `is_opted_in`, `status` (`accepted`, `pending`) |
| **Chat (G4)** | `public.gym_chat_messages` | **STRICTLY EXCLUDED** from owner analytics (Peer-to-Peer Privacy Invariant) |
| **Challenges (G5)** | `public.gym_challenges`, `public.gym_challenge_participants` | `status` (`active`, `published`), `current_value`, `is_completed` |
| **Safety / SPS (G6)** | `public.gym_safety_incidents`, `public.gym_safety_notices` | `status` (`reported`, `acknowledged`, `investigating`, `resolved`), `severity` (`critical`, `high`, `medium`, `low`), `is_active` |

---

## 3. Key Findings & Architectural Gaps

1. **Fragmented Network Waterfall**:
   Currently, the dashboard triggers multiple client-initiated queries. Expanding this to 8 or 10 subsystems by firing individual queries every 20 seconds would cause severe database connection pool exhaustion and client UI jitter.
2. **Missing Operational Action Hub**:
   Owners currently have no single place to see what demands immediate attention. An open critical physical hazard, a spike in pending member requests, or unmoderated community flags require clicking through 4 separate menu tabs.
3. **Absence of Peak Utilization Curve**:
   Owners lack visibility into hourly floor utilization across the operating day, preventing informed staffing or equipment maintenance scheduling.
4. **Timezone Authority**:
   While `gyms.timezone` exists in the database schema (defaulting to `'Asia/Kolkata'`), client queries currently calculate day ranges partially using local device scripts, creating edge-case discrepancies across timezone transitions.
5. **Strict Privacy Boundaries (G4 & G6)**:
   Any aggregate dashboard query must strictly adhere to the privacy contracts established in G4 (zero chat visibility) and G6 (whistleblower anonymity and zero emergency contact data exposure in analytics).

---

## 4. Phase G7 Strategy & Goals

1. **Unified Authoritative RPC**:
   Implement a single `SECURITY DEFINER` stored procedure, `public.get_owner_dashboard_overview(p_gym_id UUID)`, that calculates all operational KPIs and alert summaries server-side in a single database round-trip (~10ms).
2. **Action-Oriented Triage**:
   Provide an "Operational Attention Required" section with direct deep links to `/owner/members`, `/owner/safety`, `/owner/community`, and `/owner/challenges`.
3. **Hourly Facility Utilization**:
   Calculate today's check-in distribution grouped by facility-local hour (00:00 to 23:00) to render a clean, lightweight peak-hour bar chart.
4. **Preserve Baseline Invariants**:
   Maintain 100% backward compatibility with existing G1–G6 behavior, keep client-side bundle size minimal, and ensure 787/787 regression tests remain green.
