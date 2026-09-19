# FitSphere / GymBuddy — Member Context UX Architecture

## 1. Core Architectural Principle

**Personal Fitness is the core product. Integrated Gym is an additive layer.**

Joining an integrated partner gym or training in an external gym NEVER replaces or removes the Personal Fitness Core. The user always retains full athlete-first sovereignty over their personal fitness journey.

| Context | Core Model | Visual & Functional Behavior |
| :--- | :--- | :--- |
| **Home Mode** | Personal Fitness Core | Home bodyweight / equipped workouts, nutrition, personal streak, FitCoins ledger, PRs, progress, secondary gym discovery card. |
| **External Gym** | Personal Fitness Core + Commercial Gym Context | All personal features remain fully available. Shows contextual **Commercial Gym Mode** badge. Workout generator adjusts for commercial equipment (Barbells, Cables, Dumbbells, Machines). Private partner gym features remain hidden. |
| **Integrated Gym** | Personal Fitness Core + Integrated Gym Layer | All personal features remain fully available. Unlocks **My Gym Command Center**, 1-tap QR Check-in, Gym Attendance Streak, Community feed, Buddy finder/chat, Challenges, Events & RSVP, Safety SOS, and facility perks. |

---

## 2. Membership States & Access Gating

Membership status authoritative derivation rules:

- **None**: Home mode. Shows exploration and join requests.
- **Pending**: Home mode. Shows "Request Pending" on gym discovery modal. Private gym feeds/check-in/buddies remain restricted.
- **Active**: Integrated mode. Unlocks full integrated facility layer across dashboard, navigation, streaks, rewards, and community.
- **Frozen**: Restricts gym operational features (check-in, RSVP). Personal fitness core remains 100% active.
- **Inactive / Cancelled**: Reverts to Home or External mode. Personal history, PRs, and FitCoins remain intact.

---

## 3. Strict Ledger Separation

1. **Personal Workout Streak vs Gym Attendance Streak**:
   - *Personal Workout Streak*: Number of consecutive workout days completed anywhere (Home or Gym). Authoritative ledger protected by 3 free monthly revives.
   - *Gym Attendance Streak*: Number of consecutive days with verified physical facility check-ins at the integrated club.
   - *Rule*: Never merge them into a single misleading number.

2. **Personal FitCoins vs Club Perks**:
   - *Personal FitCoins*: Earned via workout completion, streak milestones, and personal records. Used in the Rewards Shop catalog.
   - *Club Perks*: Sponsored directly by the facility based on verified attendance visits. Claimable at the front desk.
   - *Rule*: Club perks never deduct from personal FitCoins.
