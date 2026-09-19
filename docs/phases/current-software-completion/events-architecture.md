# Technical Architecture — Gym Events & RSVP System

## 1. Database Schema Design

### `public.gym_events`
- `id` (UUID, Primary Key, `gen_random_uuid()`)
- `gym_id` (UUID, Foreign Key → `public.gyms(id)` ON DELETE CASCADE)
- `created_by` (UUID, Foreign Key → `auth.users(id)`)
- `title` (TEXT, NOT NULL)
- `description` (TEXT)
- `event_type` (TEXT, NOT NULL, CHECK in `('workshop', 'bootcamp', 'class', 'competition', 'social', 'seminar', 'other')`)
- `starts_at` (TIMESTAMPTZ, NOT NULL)
- `ends_at` (TIMESTAMPTZ)
- `capacity` (INTEGER, CHECK `capacity > 0 OR capacity IS NULL`)
- `location_text` (TEXT)
- `status` (TEXT, NOT NULL DEFAULT 'draft', CHECK in `('draft', 'published', 'cancelled', 'completed')`)
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`)
- `updated_at` (TIMESTAMPTZ, DEFAULT `NOW()`)

Indexes:
- `idx_gym_events_gym_status` ON `(gym_id, status)`
- `idx_gym_events_starts_at` ON `(starts_at)`

---

### `public.gym_event_rsvps`
- `id` (UUID, Primary Key, `gen_random_uuid()`)
- `event_id` (UUID, Foreign Key → `public.gym_events(id)` ON DELETE CASCADE)
- `gym_id` (UUID, Foreign Key → `public.gyms(id)` ON DELETE CASCADE)
- `user_id` (UUID, Foreign Key → `auth.users(id)` ON DELETE CASCADE)
- `status` (TEXT, NOT NULL DEFAULT 'attending', CHECK in `('attending', 'cancelled')`)
- `created_at` (TIMESTAMPTZ, DEFAULT `NOW()`)
- `updated_at` (TIMESTAMPTZ, DEFAULT `NOW()`)

Constraints:
- UNIQUE `(event_id, user_id)`

Indexes:
- `idx_gym_event_rsvps_event_user` ON `(event_id, user_id)`
- `idx_gym_event_rsvps_user` ON `(user_id)`

---

## 2. Concurrency & Locking Architecture
To prevent overbooking when multiple members submit RSVPs for the final open spot at the exact same millisecond, the RPC `rsvp_gym_event` acquires a row lock:

```sql
-- Lock event row to serialize concurrent reservations
SELECT * INTO v_event
FROM gym_events
WHERE id = p_event_id
FOR UPDATE;

-- Verify capacity constraint
IF v_event.capacity IS NOT NULL THEN
  SELECT COUNT(*) INTO v_count
  FROM gym_event_rsvps
  WHERE event_id = p_event_id AND status = 'attending';

  IF v_count >= v_event.capacity THEN
    RAISE EXCEPTION 'CAPACITY_REACHED: Event is already full';
  END IF;
END IF;
```

This ensures serialized transaction execution without dirty reads or phantom overbooking.
