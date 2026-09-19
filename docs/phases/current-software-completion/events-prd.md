# Product Requirements Document (PRD) — Gym Events & RSVP

## 1. Context & Business Value
FitSphere facilities run coaching seminars, Olympic weightlifting workshops, community bootcamps, and special group classes. Prior to this release, owners lacked facility event scheduling, and members had no native mechanism to discover sessions or reserve spots within their active gym.

## 2. User Personas & Core Journeys

### Persona A: Gym Owner / General Manager
- **Goal**: Schedule facility classes and workshops, control member capacity, track RSVPs, and view the roster of attendees.
- **Workflow**:
  1. Access `/owner/events` via the Owner Console.
  2. Click "Create Event" and input title, event type, date/time, optional capacity, and facility location text.
  3. Save as a `draft` for review.
  4. Transition status to `published` to surface to active gym members.
  5. Inspect the attendee roster in real time to prepare floor space and coaching staff.
  6. Mark the event `completed` or `cancelled` as appropriate.

### Persona B: Active Gym Member
- **Goal**: Discover upcoming sessions at their home gym and reserve a spot without risk of overbooking.
- **Workflow**:
  1. Navigate to `/app/gym/events` from the Gym directory.
  2. View upcoming published sessions with capacity counters and instructor details.
  3. Click "RSVP Now" to claim an available spot.
  4. View reservation confirmation with "Reserved" badge and option to cancel if schedule changes.

## 3. Functional Requirements
1. **Event State Machine**:
   - `draft`: Only visible to the gym owner.
   - `published`: Visible to active gym members for RSVP.
   - `completed`: Archived historical record.
   - `cancelled`: Flagged as cancelled; RSVPs locked.
2. **Atomic Capacity Reservation**:
   - If capacity is `NULL`, attendance is unlimited.
   - If capacity is an integer > 0, concurrent RSVPs must be locked via `SELECT ... FOR UPDATE` to prevent exceeding total capacity.
3. **Idempotent Actions**:
   - Re-clicking RSVP by an already-registered user must return the existing confirmation without incrementing counts.
   - Cancelling RSVP must decrement the attendee counter atomically.
4. **Facility Timezone Authority**:
   - Event scheduling adheres to the facility's local timezone (e.g. `Asia/Kolkata`), preventing browser-side timezone misinterpretation.
