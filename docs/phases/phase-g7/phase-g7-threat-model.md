# Phase G7: Threat Model & Security Audit

## 1. Threat Matrix

| Threat ID | Threat Category | Attack Path | Architectural Defense & Mitigation | Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **TM-G7-01** | **Cross-Gym Metric Leakage** | Owner A invokes `get_owner_dashboard_overview` with `p_gym_id = Gym B`. | Stored procedure strictly asserts `SELECT 1 FROM gyms WHERE id = p_gym_id AND owner_id = auth.uid()`. Fails with SQLSTATE `40301`. | Execute RPC as Owner A for Gym B; assert `40301 Unauthorized`. |
| **TM-G7-02** | **Unauthenticated Access** | Anonymous internet caller invokes PostgREST RPC directly. | Stored procedure checks `auth.uid() IS NULL` and aborts with SQLSTATE `40100`. | Call RPC without Authorization header; assert `40100 Authentication required`. |
| **TM-G7-03** | **Regular Member Privilege Escalation** | Authenticated gym member attempts to view owner operations metrics. | Stored procedure ownership check rejects non-owners with SQLSTATE `40301`. | Call RPC as regular member; assert `40301`. |
| **TM-G7-04** | **Whistleblower De-anonymization via Analytics** | Owner inspects dashboard payload attempting to correlate safety incident timing with active floor sessions. | Dashboard returns strictly aggregate counts (`open_safety_incidents_count`). Incidents are never joined to individual users in the dashboard payload. | Inspect RPC JSON schema; assert zero `reporter_id`, names, or timestamps are returned. |
| **TM-G7-05** | **Private Chat Eavesdropping via Dashboard** | Owner seeks analytics on member private conversations or buddy message contents. | G4 `gym_chat_messages` are strictly air-gapped from G7 analytics. Zero chat volume or content fields exist in the RPC. | Inspect RPC definition; assert zero references to `gym_chat_messages`. |
| **TM-G7-06** | **Emergency Contact / Medical Data Exfiltration** | Operator attempts to bulk-harvest member emergency phone numbers or medical notes via analytics. | Emergency contacts are never queried by G7. Access remains strictly gated by active check-in via G6 RPC with immutable access audit logging. | Inspect RPC definition; assert zero references to `gym_emergency_contacts`. |
| **TM-G7-07** | **Timezone Manipulation / Temporal Discrepancy** | Client manipulates local device clock or HTTP headers to distort daily check-in counts. | Date boundaries are calculated exclusively server-side using `gyms.timezone` in PostgreSQL. Client device clock is ignored. | Set client time to yesterday; assert dashboard check-ins match facility calendar day. |
| **TM-G7-08** | **Denial of Service via Heavy Polling** | Client tab left open fires rapid requests, creating database connection pool saturation. | Lightweight single-transaction query (~10ms execution) with index scans; client implements 20-second polling interval and cancels in-flight requests on unmount. | Run 100 concurrent RPC calls; assert database CPU remains stable and p99 latency < 50ms. |
| **TM-G7-09** | **Count Inference / Small Sample Re-identification** | In a 1-member gym, owner infers an athlete's visit duration from `today_avg_duration_minutes`. | Completed visit durations are already visible to facility owners in the authorized attendance ledger (`fetchGymAttendanceHistory`). No new privilege is created. | Verified by design: Ledger is already owner-accessible under Phase C7. |
| **TM-G7-10** | **Stale Metrics Presented as Real-Time** | Network disconnection causes client to render cached floor occupancy as live. | Client UI displays explicit timestamp (`generatedAt`) and renders visual stale indicator if polling fails. | Simulate network offline; assert UI displays reconnection banner. |

---

## 2. Attack Surface Analysis & Code Verification

### 2.1 Defense Against Malicious `p_gym_id` Injection
```sql
-- PostgreSQL Stored Procedure Protection:
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
- The client input `p_gym_id` is treated strictly as untrusted data.
- The authorization check executes before any aggregate data query is performed.
- If the caller does not own the facility, the transaction terminates instantly without touching attendance or member tables.
