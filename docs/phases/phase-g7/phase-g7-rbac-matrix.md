# Phase G7: RBAC & Security Matrix

## 1. Role-Based Access Control (RBAC) Matrix

| Entity / RPC | Operation | Anonymous (`anon`) | Authenticated Member | Owner of Target `gym_id` | Owner of Different Gym | Platform Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`public.get_owner_dashboard_overview`** | **EXECUTE** | ❌ **DENIED (40100)** | ❌ **DENIED (40301)** | ✅ **PERMITTED** | ❌ **DENIED (40301)** | ✅ **PERMITTED** |
| **`public.gym_attendance_sessions`** | **SELECT** | ❌ **DENIED** | Own sessions only | Floor / Completed for owned gym | ❌ **DENIED** | ✅ Full Access |
| **`public.gym_memberships`** | **SELECT** | ❌ **DENIED** | Own membership only | Memberships of owned gym | ❌ **DENIED** | ✅ Full Access |
| **`public.gym_safety_incidents`** | **Direct SELECT** | ❌ **DENIED** | Own reports only | ❌ **DENIED (Must use G6 RPC)** | ❌ **DENIED** | ❌ **DENIED** |
| **`public.gym_safety_incident_logs`** | **Direct SELECT** | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED (Must use G6 RPC)** | ❌ **DENIED** | ❌ **DENIED** |
| **`public.gym_chat_messages`** | **Direct SELECT** | ❌ **DENIED** | Chat participants only | ❌ **DENIED (Private Peer Chat)** | ❌ **DENIED** | ❌ **DENIED** |
| **`public.gym_emergency_contacts`** | **Direct SELECT** | ❌ **DENIED** | Own contact only | ❌ **DENIED (Must use G6 RPC)** | ❌ **DENIED** | ❌ **DENIED** |
| **`public.gym_emergency_contact_access_logs`** | **Direct SELECT** | ❌ **DENIED** | Own audit records only | ❌ **DENIED** | ❌ **DENIED** | ❌ **DENIED** |

---

## 2. Server-Side Security Enforcement Rules

### 2.1 Multi-Tenant Facility Verification
Every invocation of `public.get_owner_dashboard_overview(p_gym_id UUID)` executes the following check:

```sql
IF NOT EXISTS (
    SELECT 1 FROM public.gyms g
    WHERE g.id = p_gym_id
      AND (g.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
      ))
) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not the verified owner of this facility' USING ERRCODE = '40301';
END IF;
```

### 2.2 Privacy Firewalls & Cross-Subsystem Protections
1. **Whistleblower Anonymity Preservation**:
   - G7 dashboard metrics count open and critical incidents via `COUNT(*)`.
   - The RPC never selects, joins, or returns `reporter_id`, display names, or raw incident text.
   - It is mathematically impossible for an owner to deanonymize an athlete through the dashboard response.
2. **Private Peer-to-Peer Chat Isolation**:
   - G4 `gym_chat_messages` are strictly excluded from the dashboard summary.
   - Owners cannot view message volumes, conversation lengths, or chat timestamps.
3. **Emergency Contact Safeguard**:
   - `gym_emergency_contacts` and `gym_emergency_contact_access_logs` are never queried by G7.
   - Emergency contact lookup remains strictly on-demand in the live floor table, gated by active check-in and recorded in immutable access audit ledgers.
