# Access Control & RBAC Matrix — Gym Events

## 1. Actor Boundaries

| Actor Role | View Drafts | View Published Events | Create Events | Change Status | View Roster | RSVP / Cancel Own | Cancel Other RSVP |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gym Owner (Host Gym)** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Staff) | ❌ |
| **Gym Owner (Other Gym)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Active Gym Member** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Non-Member / Unenrolled** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Anonymous Visitor** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 2. Row Level Security Policies

### Policy 1: `Active members and owners view gym events`
- **Target**: `public.gym_events`
- **Action**: `SELECT`
- **Condition**:
  ```sql
  (status IN ('published', 'completed') AND EXISTS (
    SELECT 1 FROM gym_memberships m
    WHERE m.gym_id = gym_events.gym_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  ))
  OR EXISTS (
    SELECT 1 FROM gyms g
    WHERE g.id = gym_events.gym_id
      AND g.owner_id = auth.uid()
  )
  ```

### Policy 2: `Deny direct write operations`
- **Target**: `public.gym_events`
- **Action**: `INSERT`, `UPDATE`, `DELETE`
- **Rule**: Direct client DML is denied. All mutations occur strictly via `create_gym_event` and `update_gym_event_status` RPCs under `SECURITY DEFINER`.

---

## 3. Threat Modeling & IDOR Mitigations
- **IDOR on Event Creation**: `create_gym_event` verifies `g.owner_id = auth.uid()`. An attacker cannot supply another owner's `gym_id`.
- **IDOR on Event Lifecycle**: `update_gym_event_status` joins `gym_events` with `gyms` and asserts `owner_id = auth.uid()`.
- **IDOR on RSVP Cancellation**: `cancel_gym_event_rsvp` operates solely on `user_id = auth.uid()`.
