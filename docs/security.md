# Security Model & Threat Matrix — Fitness Platform Phase 1

## 1. Core Security Principles

1. **Secure by Design**: Zero implicit trust of client-submitted parameters.
2. **Database as Source of Truth**: Authorization, ownership, and metric calculations are enforced in PostgreSQL.
3. **Defense in Depth**: Client validation -> API boundary authorization -> PostgreSQL Row Level Security.
4. **Least Privilege**: Secret API keys and service-role keys are restricted to Supabase Edge Functions; the client only receives the public anon key.
5. **No AI Authority**: The AI model is strictly advisory; it cannot execute database mutations or reward allocations.

---

## 2. Threat Model Matrix (20 Production Threats)

| # | Threat | Mitigation Strategy | Enforcement Layer | Automated Test Verification |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Broken Access Control** | RLS enabled on 100% of user-owned tables | PostgreSQL Engine | `rls-isolation.test.ts`: User A denied reading User B rows |
| 2 | **Insecure Direct Object Reference (IDOR)** | Queries filter strictly by `auth.uid()`; UUIDs verified | PostgreSQL Policies & RPC | `idor-defense.test.ts`: Supplying User B's UUID fails |
| 3 | **Unauthenticated Access** | JWT Bearer verification on protected routes and RPCs | Supabase Auth Gateway | Unauthenticated query returns 401 Unauthorized |
| 4 | **Privilege Escalation** | Client cannot supply `user_id`, `role`, or `admin` status | Database RPCs / JWT | Client-passed user_id is ignored; derived from `auth.uid()` |
| 5 | **Double-Submission / Concurrency** | Unique constraints + `FOR UPDATE` row locks | PostgreSQL Transactions | `idempotency.test.ts`: Parallel requests yield 1 completion |
| 6 | **Duplicate Coin Rewards** | Unique constraint `(user_id, source, reference_id)` | PostgreSQL Schema | Replaying milestone reward causes unique violation |
| 7 | **Forged Streaks / PRs** | Authoritative calculations computed server-side in RPC | PostgreSQL Function | Client-submitted PR or streak counts are rejected |
| 8 | **Coin Ledger Tampering** | Append-only RLS: `UPDATE` and `DELETE` denied to users | PostgreSQL RLS | User UPDATE on `fitness_coins` affects 0 rows |
| 9 | **Secret Key Leakage** | Strictly `VITE_` public keys in client; secrets in Vault | Vite Build & `.gitignore` | Automated secret scanning in CI/CD pipeline |
| 10 | **Prompt Injection** | Delimited untrusted input, zero tool authority, schema check| Supabase Edge Function | Injection prompt returns safe fallback response |
| 11 | **AI Abuse / Cost Drain** | Database-backed rate limits (15/hr) + 500-char cap | Edge Function & DB | 16th query in 1 hour returns 429 Too Many Requests |
| 12 | **SQL Injection** | Parameterized queries & Supabase client ORM only | PostgreSQL / SDK | Dynamic SQL string concatenation strictly forbidden |
| 13 | **Cross-Site Scripting (XSS)** | React automatic output escaping & CSP headers | React & Firebase Hosting | Script tags in notes render as plaintext |
| 14 | **Excessive Data Exposure** | Scoped queries (no unbounded `SELECT *`) | Application Service Layer| Payloads contain only required domain fields |
| 15 | **Stale / Malformed Data** | Input validation schemas (ranges, enums, UUIDs) | Domain & Service Layer | Non-positive weights/reps rejected with 400 Bad Request |
| 16 | **Network Interruption** | Local draft persistence + idempotent retry | `useWorkoutSession.ts` | Disconnected client resumes session without data loss |
| 17 | **AI Service Outage** | Graceful degradation with fallback UI | Frontend / Service | Core workout/nutrition works when AI endpoint returns 503 |
| 18 | **PII / Token Logging** | Structured sanitized logger | `logger.ts` | Passwords, tokens, and PII stripped before logging |
| 19 | **Revive Quota Bypass** | Monthly count check within RPC | PostgreSQL RPC | 4th revive attempt in calendar month rejected |
| 20 | **Session Expiration** | Silent token refresh + clean logout handler | `useAuth.ts` | Expired refresh token redirects to login safely |

---

## 3. Secret Management & Key Rotation

- **Production Supabase Project**: `GYM` (Reference: `zmfwtidtilghminwirjx`)
- **Client-Safe Publishable Key**:
  - `VITE_SUPABASE_URL=https://zmfwtidtilghminwirjx.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_qhgrBeVEFS70VsXUrQ-8XA_Ds2w8hxu`
  - *Publishable keys are intentionally safe for browser distribution because Row Level Security (RLS) protects all user data.*
- **Firebase Web Configuration**:
  - Project: `gymbuddy-da185`
  - Delivery: Firebase Hosting & privacy-safe client delivery only.
  - *No Firebase Authentication or Firestore is permitted.*
- **Privileged Server Secrets (Supabase Edge Function Vault ONLY)**:
  - `SUPABASE_SECRET_KEY`: Server-only secret key for privileged operations in Edge Functions.
  - `AI_PROVIDER_API_KEY`: Key for LLM inference in Edge Functions.

> [!CAUTION]
> **COMPROMISED CREDENTIAL ROTATION PROTOCOL**
> Because the development Secret Key (`sb_secret_liVcr2j...`) was pasted into chat transcripts during development, it must be treated as compromised.
> 1. Go to Supabase Dashboard: `https://supabase.com/dashboard/project/zmfwtidtilghminwirjx/settings/api-keys`
> 2. Revoke the existing Secret Key and generate a fresh replacement.
> 3. Inject the replacement key exclusively into Supabase Edge Functions using:
>    `supabase secrets set SUPABASE_SECRET_KEY="new-secret-key"`
> 4. NEVER place the Secret Key into `.env`, `.env.local`, React components, or client code.
> 5. Automated scanner (`npm run audit:secrets`) will continuously fail builds if any privileged key pattern is detected in client code.
