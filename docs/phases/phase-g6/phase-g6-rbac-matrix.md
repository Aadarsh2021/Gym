# Phase G6 — Gym Safety & SPS
## Hardened RBAC & Row Level Security (RLS) Matrix

**Document Version:** 1.1.0 (Hardened)  
**Security Model:** Zero-Trust Client Storage + RPC-Only Ingress/Egress for Sensitive Records  

---

## 1. Table-Level RLS Matrix

| Table | Command | Member Role | Facility Owner Role | Reported Party Role | Unauthenticated (anon) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`gym_safety_incidents`** | **SELECT** | ✅ **Own Reports ONLY** (`reporter_id = auth.uid()`) | ❌ **DENIED** (Must use `get_gym_safety_incidents` RPC) | ❌ **DENIED** (Zero visibility) | ❌ **DENIED** |
| | **INSERT** | ❌ **DENIED** (Must use `report_gym_safety_incident` RPC) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| | **UPDATE** | ❌ **DENIED** (Reports are immutable to authors) | ❌ **DENIED** (Must use `update_safety_incident_status` RPC) | ❌ **DENIED** | ❌ **DENIED** |
| | **DELETE** | ❌ **DENIED** (Permanent retention for liability) | ❌ **DENIED** (No hard deletion permitted) | ❌ **DENIED** | ❌ **DENIED** |
| **`gym_safety_incident_logs`** | **SELECT** | ❌ **DENIED** | ❌ **DENIED** (Must use `get_safety_incident_audit_trail` RPC) | ❌ **DENIED** | ❌ **DENIED** |
| | **INSERT** | ❌ **DENIED** (System transaction append only) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| | **UPDATE** | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** | ❌ **DENIED** |
| | **DELETE** | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** | ❌ **DENIED** |
| **`gym_emergency_contacts`** | **SELECT** | ✅ **Own Contact ONLY** (`user_id = auth.uid()`) | ❌ **DENIED** (Must use `get_active_member_emergency_contact` RPC) | ❌ **DENIED** | ❌ **DENIED** |
| | **INSERT** | ✅ Own record (`user_id = auth.uid()`) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| | **UPDATE** | ✅ Own record (`user_id = auth.uid()`) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| | **DELETE** | ✅ Own record (`user_id = auth.uid()`) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| **`gym_emergency_contact_access_logs`** | **SELECT** | ✅ **Own Access Audit ONLY** (`member_user_id = auth.uid()`) | ❌ **DENIED** (Tamper/snooping prevention) | ❌ **DENIED** | ❌ **DENIED** |
| | **INSERT** | ❌ **DENIED** (Appended exclusively by RPC) | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |
| | **UPDATE** | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** | ❌ **DENIED** |
| | **DELETE** | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** (Strictly immutable) | ❌ **DENIED** | ❌ **DENIED** |
| **`gym_safety_notices`** | **SELECT** | ✅ Active members of `gym_id` | ✅ Verified facility owner of `gym_id` | ✅ Active members of `gym_id` | ❌ **DENIED** |
| | **INSERT** | ❌ **DENIED** (Must use `publish_gym_safety_notice` RPC) | ❌ **DENIED** (Must use `publish_gym_safety_notice` RPC) | ❌ **DENIED** | ❌ **DENIED** |
| | **UPDATE** | ❌ **DENIED** | ❌ **DENIED** (Must use RPC) | ❌ **DENIED** | ❌ **DENIED** |
| | **DELETE** | ❌ **DENIED** | ❌ **DENIED** (Must use RPC) | ❌ **DENIED** | ❌ **DENIED** |

---

## 2. PostgreSQL RLS Policies Specification

### 2.1 Policies on `public.gym_safety_incidents`

```sql
ALTER TABLE public.gym_safety_incidents ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Reporters can view ONLY their own reports
DROP POLICY IF EXISTS "Reporters view own safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Reporters view own safety incidents"
ON public.gym_safety_incidents FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- 2. INSERT: Denied directly (must route through report_gym_safety_incident RPC)
DROP POLICY IF EXISTS "Deny direct client insert on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client insert on safety incidents"
ON public.gym_safety_incidents FOR INSERT
TO authenticated
WITH CHECK (FALSE);

-- 3. UPDATE: Denied directly (must route through update_safety_incident_status RPC)
DROP POLICY IF EXISTS "Deny direct client update on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client update on safety incidents"
ON public.gym_safety_incidents FOR UPDATE
TO authenticated
USING (FALSE);

-- 4. DELETE: Denied permanently for liability/legal retention
DROP POLICY IF EXISTS "Deny direct client delete on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client delete on safety incidents"
ON public.gym_safety_incidents FOR DELETE
TO authenticated
USING (FALSE);
```

### 2.2 Policies on `public.gym_safety_incident_logs`

```sql
ALTER TABLE public.gym_safety_incident_logs ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (egress and ingress mediated strictly by RPC)
DROP POLICY IF EXISTS "Deny direct client select on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client select on incident logs"
ON public.gym_safety_incident_logs FOR SELECT
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client insert on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client insert on incident logs"
ON public.gym_safety_incident_logs FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client update on incident logs"
ON public.gym_safety_incident_logs FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client delete on incident logs"
ON public.gym_safety_incident_logs FOR DELETE
TO authenticated
USING (FALSE);
```

### 2.3 Policies on `public.gym_emergency_contacts`

```sql
ALTER TABLE public.gym_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Member reads their own emergency contact ONLY (owners use RPC)
DROP POLICY IF EXISTS "Members view own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members view own emergency contact"
ON public.gym_emergency_contacts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. INSERT: Member inserts their own record
DROP POLICY IF EXISTS "Members insert own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members insert own emergency contact"
ON public.gym_emergency_contacts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. UPDATE: Member updates their own record
DROP POLICY IF EXISTS "Members update own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members update own emergency contact"
ON public.gym_emergency_contacts FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- 4. DELETE: Member deletes their own record
DROP POLICY IF EXISTS "Members delete own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members delete own emergency contact"
ON public.gym_emergency_contacts FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### 2.4 Policies on `public.gym_safety_notices`

```sql
ALTER TABLE public.gym_safety_notices ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Active gym members and verified gym owner
DROP POLICY IF EXISTS "Active members and owners view safety notices" ON public.gym_safety_notices;
CREATE POLICY "Active members and owners view safety notices"
ON public.gym_safety_notices FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_safety_notices.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_safety_notices.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- 2. Direct mutations denied (route through publish_gym_safety_notice RPC)
DROP POLICY IF EXISTS "Deny direct client insert on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client insert on safety notices"
ON public.gym_safety_notices FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client update on safety notices"
ON public.gym_safety_notices FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client delete on safety notices"
ON public.gym_safety_notices FOR DELETE
TO authenticated
USING (FALSE);
```

### 2.5 Policies on `public.gym_emergency_contact_access_logs`

```sql
ALTER TABLE public.gym_emergency_contact_access_logs ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Member reads their own access audit trail ONLY (to see who accessed their emergency contact)
DROP POLICY IF EXISTS "Members view their own contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Members view their own contact access logs"
ON public.gym_emergency_contact_access_logs FOR SELECT
TO authenticated
USING (member_user_id = auth.uid());

-- 2. Direct client mutations strictly denied (appended exclusively by get_active_member_emergency_contact RPC)
DROP POLICY IF EXISTS "Deny direct client insert on contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct client insert on contact access logs"
ON public.gym_emergency_contact_access_logs FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct client update on contact access logs"
ON public.gym_emergency_contact_access_logs FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct client delete on contact access logs"
ON public.gym_emergency_contact_access_logs FOR DELETE
TO authenticated
USING (FALSE);
```

#### Foreign Key Retention Semantics:
All four parent foreign keys (`gym_id`, `member_user_id`, `viewer_owner_id`, `attendance_session_id`) specify **`ON DELETE RESTRICT`**.
- No cascade deletion from gym deletion, account deactivation, owner transfer, or session expiration can delete access records.
- Historical audit records survive ordinary parent lifecycle events and cannot be destroyed.


### 2.6 Whistleblower Identity Protection in Audit Trail RPC (`get_safety_incident_audit_trail`)

When retrieving incident audit logs via the SECURITY DEFINER RPC `get_safety_incident_audit_trail`:
1. If the parent incident is anonymous (`is_anonymous = true`) AND the log entry actor matches the reporter (`actor_id = incident.reporter_id`):
   - `actor_id` is projected as `NULL`
   - `actor_name` is projected as `'Anonymous Member'`
   - The profile `LEFT JOIN` evaluates against `NULL` to prevent leaking display names, avatars, or UUIDs.
2. Even facility owners cannot deanonymize the reporter via audit trail queries, join conditions, or error messages.

