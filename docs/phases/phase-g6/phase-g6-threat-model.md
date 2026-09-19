# Phase G6 — Gym Safety & SPS
## Hardened Threat Model & Security Vulnerability Analysis

**Document Version:** 1.1.0 (Hardened)  
**Methodology:** STRIDE + Defense-in-Depth for High-Sensitivity Safety Records  

---

## 1. Threat Matrix

| Threat # | Vulnerability / Attack Vector | Attack Path | Architectural Defense & Hardening | Verification Test Case |
| :--- | :--- | :--- | :--- | :--- |
| **TM-01** | **Direct Table SELECT Deanonymization** | Facility owner executes `supabase.from('gym_safety_incidents').select('*')` to extract raw `reporter_id` from anonymous reports. | Table-level RLS policy on `gym_safety_incidents` **DENIES direct SELECT to facility owners**. Only the reporter can query their own row. Owners MUST use RPC. | Owner executes direct SELECT on `gym_safety_incidents`. Query returns 0 rows. |
| **TM-02** | **RPC Deanonymization via Output / Projection** | Owner inspects network JSON response of `get_gym_safety_incidents()` looking for hidden reporter metadata. | Server-side PostgreSQL projection sets `reporter_id = NULL`, `reporter_avatar_url = NULL`, and `reporter_name = 'Anonymous Member (Verified Active Membership)'` when `is_anonymous = true`. | Call RPC on anonymous report; inspect raw JSON; assert `reporter_id` is null and no PII exists. |
| **TM-03** | **Deanonymization via PostgREST Filter / Order Probing** | Owner calls PostgREST with `?reporter_id=eq.<victim_uuid>` or `order=reporter_id` to infer whether a specific athlete filed an anonymous report. | Direct PostgREST table SELECT is completely denied to owners (`USING (reporter_id = auth.uid())`). Filters and ordering on non-selectable rows leak zero information. | Owner attempts PostgREST query with `reporter_id=eq...`. Returns 0 rows. |
| **TM-04** | **Deanonymization via Database Error Messages** | Owner crafts invalid RPC inputs or foreign keys to force PostgreSQL to output `reporter_id` in constraint error messages. | RPC parameters do not accept reporter ID from callers; `reporter_id` is bound exclusively from `auth.uid()` during insertion. Error messages reveal zero caller IDs. | Execute RPC with malformed inputs. Verify error detail contains no UUID leaks. |
| **TM-05** | **Retaliatory Harassment by Reported Party** | Reported member queries database to find out who filed a conduct complaint against them. | Reported parties have **zero** SELECT privileges on `gym_safety_incidents` and `gym_safety_incident_logs`. | Reported user queries incident table. Query returns 0 rows. |
| **TM-06** | **Audit Evidence Destruction (Log Deletion)** | Accused gym owner or rogue admin attempts to execute `DELETE FROM gym_safety_incident_logs` or `DELETE FROM gym_safety_incidents`. | RLS policy `USING (FALSE)` on DELETE for all roles. Foreign key `incident_id` uses **`ON DELETE RESTRICT`**. | Attempt `DELETE` on log and incident tables. Must fail with RLS violation. |
| **TM-07** | **Audit Ledger Modification (Log Tampering)** | Attacker attempts to `UPDATE` log notes to cover up staff delay or negligence. | Table-level RLS policy `USING (FALSE)` on UPDATE. Table is strictly append-only. | Attempt `UPDATE` on `gym_safety_incident_logs`. Must fail with RLS violation. |
| **TM-08** | **Voyeuristic Emergency Contact Harvesting** | Facility owner attempts to scrape emergency phone numbers and medical notes of all athletes in the gym. | Direct table SELECT on `gym_emergency_contacts` is **DENIED to owners**. Owner retrieval is RPC-only (`get_active_member_emergency_contact`), which strictly checks active floor check-in. | Owner attempts direct SELECT on `gym_emergency_contacts`. Query returns 0 rows. |
| **TM-09** | **Post-Checkout Emergency Contact Scraping** | Facility owner attempts to retrieve an athlete's contact details after the athlete has left the gym. | RPC checks `check_out_at IS NULL`. Immediately upon checkout, RPC throws `40303: Member is not currently checked into this facility`. | Athlete checks out. Owner calls RPC for athlete's contact. Call rejected with 40303. |
| **TM-10** | **Cross-Gym Emergency Contact Snooping** | Owner of Gym A attempts to retrieve the emergency contact of a member checked into Gym B. | RPC verifies caller owns the gym where the member is checked in. Access across gyms throws `40301 Unauthorized`. | Owner of Gym A queries contact of member checked into Gym B. Call rejected. |
| **TM-11** | **Remote False Emergency SOS** | Malicious user triggers `trigger_gym_emergency_sos()` from home or a different gym to disrupt operations. | RPC derives `gym_id` server-side from active attendance session. If not actively checked in, throws `40302`. | Call SOS while not checked in. Call rejected with 40302. |
| **TM-12** | **SOS Alarm Flooding (Repeated Rapid Clicks)** | Panicking user or prankster clicks SOS 20 times in 10 seconds. | 15-minute deduplication window: if an active SOS incident already exists for this member, subsequent calls update location notes and return existing ID without creating duplicate alerts. | Click SOS 5 times rapidly. Exactly 1 canonical incident row is created. |
| **TM-13** | **Incident Report Bombing** | Disgruntled user scripts 1,000 incident reports in 5 minutes. | Database rate-limit check in `report_gym_safety_incident`: maximum 5 reports per user per rolling 60-minute window (`ERRCODE = 42901`). | Submit 6 reports in 1 minute. 6th fails with 42901. |
| **TM-14** | **Cross-Site Scripting (XSS)** | Malicious payload `<script>...</script>` injected into incident description, location, or resolution notes. | String sanitization, length bounds, and React automatic JSX string escaping. Zero usage of `dangerouslySetInnerHTML`. | Submit incident with script payload. Verify UI renders literal escaped text. |
| **TM-15** | **Self-Reporting Paradox** | Member reports themselves (`reported_user_id = auth.uid()`). | Constraint `chk_no_self_report` and RPC check `IF p_reported_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot report yourself'`. | Submit report with own user ID. Fails with 40002. |
| **TM-16** | **De-anonymization via Incident Audit Trail RPC** | Owner calls `get_safety_incident_audit_trail()` to discover the whistleblower's UUID or display name from the incident creation event. | `get_safety_incident_audit_trail` RPC masks `actor_id = NULL` and `actor_name = 'Anonymous Member'` whenever `v_incident.is_anonymous = true` AND `actor_id = v_incident.reporter_id`. Profile join key resolves to `NULL`. | Owner requests audit trail of anonymous report. Assert `actor_id` is null, name is 'Anonymous Member', and zero profile UUIDs are returned. |
| **TM-17** | **Unaccountable Emergency Contact Snooping** | Facility owner repeatedly accesses sensitive next-of-kin / medical data without audit accountability. | RPC `get_active_member_emergency_contact` atomically appends to `public.gym_emergency_contact_access_logs` with gym ID, member ID, owner ID, and attendance session ID. Members can inspect their own access log. Direct client mutations denied. | Owner accesses contact. Assert access log record exists with viewer owner, target member, gym, and session ID. Post-checkout access fails and appends no log. |
| **TM-18** | **Cascading Audit Destruction via Parent Deletion** | Rogue owner or admin deletes gym, user, or session row to destroy historical contact access logs via cascading deletion. | All four foreign keys on `gym_emergency_contact_access_logs` use **`ON DELETE RESTRICT`**. PostgreSQL rejects parent deletion with `23503: foreign_key_violation`. | Attempt parent row deletion on entity referenced by access log; assert operation is blocked by foreign key constraint. |

---

## 2. In-Depth Attack Proof: Anonymous Reporter Identity Defense

```
ATTACK PATH PROVEN IMPOSSIBLE:
1. Owner attempts: SELECT * FROM gym_safety_incidents WHERE gym_id = :my_gym;
   --> Result: 0 rows returned (RLS: reporter_id = auth.uid()).

2. Owner attempts: SELECT * FROM gym_safety_incidents WHERE reporter_id = :suspect_user;
   --> Result: 0 rows returned (RLS denies owner direct SELECT).

3. Owner attempts PostgREST filter: /gym_safety_incidents?is_anonymous=eq.true&reporter_id=eq.:suspect
   --> Result: 0 rows returned (RLS filters out all rows before evaluation).

4. Owner calls RPC: get_gym_safety_incidents(:my_gym)
   --> Result: PostgreSQL projection forces:
       CASE WHEN is_anonymous THEN NULL ELSE reporter_id END AS reporter_id
       CASE WHEN is_anonymous THEN 'Anonymous Member (Verified Active Membership)' ELSE p.display_name END AS reporter_name
       CASE WHEN is_anonymous THEN NULL ELSE p.avatar_url END AS reporter_avatar_url
   --> Raw reporter_id never leaves PostgreSQL buffer pool.

5. Owner queries incident audit log table: SELECT * FROM gym_safety_incident_logs
   --> Result: 0 rows returned (Direct SELECT denied to all client roles).

6. Owner calls audit trail RPC: get_safety_incident_audit_trail(:anonymous_incident_id)
   --> Result: PostgreSQL projection forces:
       CASE WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN NULL ELSE l.actor_id END AS actor_id
       CASE WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN 'Anonymous Member' ELSE COALESCE(p.display_name, 'Staff') END AS actor_name
       LEFT JOIN public.profiles p ON (CASE WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN NULL ELSE l.actor_id END) = p.id
   --> Reporter identity, display name, and UUID are completely sanitized from audit trail.

7. Owner attempts to access emergency contact without trace:
   --> Result: Every invocation of get_active_member_emergency_contact atomically inserts
       into gym_emergency_contact_access_logs. Table is append-only and immutable.
```
