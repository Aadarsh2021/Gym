# FitSphere / GymBuddy — Navigation & Information Architecture

## 1. Desktop Sidebar (Breakpoint $\ge 1024\text{px}$)

Stationary, 275px fixed desktop sidebar organized into two distinct sections:

### Section 1: Personal Training Core
- **Home** (`/app`) — Personal athlete dashboard, today's workout, consistency streak.
- **Workouts** (`/app/workouts`) — Workout routines, splits, active training runner.
- **Nutrition** (`/app/nutrition`) — Macro targets, meal generator, food diary.
- **Streaks** (`/app/streaks`) — Consistency ledger, monthly streak revives, FitCoins.
- **Progress** (`/app/progress`) — PR timeline, volume progression, personal body stats.
- **Rewards Shop** (`/app/rewards`) — Personal FitCoins catalog and redemption history.
- **Exercises** (`/app/exercises`) — Visual exercise library and form guides.

### Section 2: My Gym & Community Layer
- **When NOT Integrated**:
  - **Explore Gyms** (`/app/gym`) — Public directory of partner training centers with search & request join.
- **When ACTIVE Integrated**:
  - **My Gym** (`/app/gym`) — Member command portal, QR Check-In, attendance logs.
  - **Community** (`/app/gym/community`) — Gym feed, post composer, training updates.
  - **Buddies** (`/app/gym/buddies`) — Match cards, training schedules, direct chat.
  - **Challenges** (`/app/gym/challenges`) — Motivational facility leaderboards and target progress.
  - **Events** (`/app/gym/events`) — Member class bookings, RSVP, spots remaining.
  - **Safety & SOS** (`/app/gym/safety`) — 1-tap SOS, anonymous incident reporting.

---

## 2. Mobile Bottom Navigation (Breakpoint $< 1024\text{px}$)

Strictly 5 primary tap targets to prevent crowding on mobile viewports:

### Integrated Gym Member
1. **Home**
2. **Workouts**
3. **My Gym**
4. **Community**
5. **More** (opens native-style bottom sheet containing: Nutrition, Streaks, Progress, Rewards, Exercises, Buddies, Challenges, Events, Safety SOS, Settings)

### Home & External Gym Athletes
1. **Home**
2. **Workouts**
3. **Nutrition**
4. **Streaks**
5. **More** (opens native-style bottom sheet containing: Progress, Rewards, Exercises, Find Gym, Settings)
