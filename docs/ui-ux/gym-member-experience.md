# FitSphere / GymBuddy — Integrated Gym Member Experience

## 1. The Additive Facility Model

When an athlete joins an integrated partner gym:
- **Personal Core remains 100% untouched**: All past workout history, personal PRs, macros, streaks, and FitCoins belong to the member, not the facility.
- **Gym layer adds**:
  1. **My Gym Home Portal (`/app/gym`)**: Fast 1-tap QR check-in, live announcements, quick navigation to buddies, events, and safety.
  2. **Gym Attendance Streak**: Displays consecutive days with verified physical facility visits.
  3. **Community Feed (`/app/gym/community`)**: Facility-scoped post feed with moderation, likes, and comments.
  4. **Buddy Finder (`/app/gym/buddies`)**: Goal, experience, and schedule-matching cards with privacy preservation and in-app chat.
  5. **Events & Booking (`/app/gym/events`)**: Facility class schedules, spots remaining, and instant RSVP.
  6. **Challenges & Leaderboard (`/app/gym/challenges`)**: Server-authoritative fitness competitions and verified rankings.
  7. **Safety & SPS (`/app/gym/safety`)**: SOS emergency action, incident reporting, and safety notices.
  8. **Gym Perks**: Visit-based facility rewards claimable at the front desk.

---

## 2. Empty States & Anti-Fabrication Principles

- All community, buddy, challenge, event, and announcement feeds show authentic empty states when no activity has been logged.
- FitSphere never injects fake members, fake likes, or simulated social activity.
