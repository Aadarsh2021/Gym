# Current Software-Only Completion — Product Scope & Governance

## 1. Executive Summary
This document establishes the authoritative scope boundaries for the software-only completion phase of the FitSphere (GymBuddy) platform, bridging the V1 athlete experience and the G1–G7 facility operations suite.

## 2. In-Scope Software Capabilities (Implemented Now)

### A. Workout Alarm UX & Timing System
- Live second-by-second countdown UI (`days`, `hours`, `minutes`, `seconds`).
- Smart Repeat weekday scheduling (`scheduled_days` 1–7) with multi-day rollover calculation.
- Idempotent 10-minute quick snooze with singleton handle replacement to eliminate duplicate alerts.
- Single-instance `WebAudioAdapter` audio chime invocation without recreating `AudioContext` instances.
- Haptic vibration fallback for supported mobile browsers.
- Transparent browser limitation disclosure explaining foreground/background tab execution.
- Strict boundary: **NO Web Push** (retained for future V2 native/service-worker release).

### B. Gym Events & Atomic RSVP Lifecycle
- Facility-scoped events management for gym owners (`/owner/events`).
- Event lifecycle state machine: `draft` → `published` → `completed` | `cancelled`.
- Atomic member RSVPs with row-level locking (`SELECT ... FOR UPDATE`) to prevent capacity overbooking under concurrency.
- Idempotent reservation handling for repeat clicks.
- Owner attendee roster inspection modal (`get_gym_event_attendees` RPC).
- Member community event discovery and 1-click RSVP (`/app/gym/events`).
- Cross-gym tenant boundary: Owner A cannot view/manage Gym B events; members cannot view drafts or events of gyms where they hold no active membership.

### C. Fitness Coin Rewards Shop
- Separation of concerns: Personal Fitness Coins (earned via workouts, PRs, and streaks) vs G1 gym attendance perks.
- Authoritative catalog of digital athletic perks, badges, and partner benefits (`/app/rewards`).
- Atomic server-side debit RPC (`redeem_fitness_reward`) ensuring zero client-dictated coin balances or prices.
- Redemption history ledger tracking unique alphanumeric claim codes and spent coins.
- Strict boundary: **NO E-Commerce / Paid Add-Ons** (no third-party payment gateway or card processing in this phase).

### D. Women-Specific Safety Enhancements
- Safe Departure & Session Check-Out Share protocol: 1-click user-initiated generation of prefilled SMS and WhatsApp messages to trusted emergency contacts.
- Female-Only / Same-Gender Buddy Matching: explicit opt-in preference guaranteeing female athletes only match with verified female members.
- G6 SPS privacy protection: immutable masking of anonymous hazard reporters (`user_id = NULL`, `reporter_name = 'Anonymous Member'`).
- Strict boundary: **NO Continuous GPS Tracking**; zero invasive background location polling.

---

## 3. Deferred Scope Matrix

| Capability Category | Phase Allocation | Reason for Deferral |
| :--- | :--- | :--- |
| **Web Push Notifications** | V2 | Requires push service worker registration, push subscription exchange, and APNs/FCM keys. |
| **Smart Deload Planner / Training Balance** | Retention V2 | Requires multi-week longitudinal load modeling. |
| **Equipment Heatmap & IoT Sensors** | Hardware / V3 | Dependent on physical hardware sensor installations. |
| **Wearable Integrations (Apple Watch / Garmin)** | V2 Native | Dependent on native OS health APIs. |
| **Camera Form Analysis & Auto-Rep Counting** | V2.5 AI / Computer Vision | Heavy client ML model pipeline. |
| **Multi-City Gym Network Pass** | V3 Enterprise | Requires cross-chain franchise billing and reconciliation. |
| **E-Commerce Storefront / Paid Supplements** | V3 Marketplace | Payment gateway integration out of current scope. |
| **Broad Social Media / Public Feeds** | Explicitly Excluded | FitSphere remains an athletic training OS, not a public social network. |
