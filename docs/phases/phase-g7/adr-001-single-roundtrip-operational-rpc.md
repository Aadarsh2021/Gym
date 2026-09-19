# ADR-001: Single-Roundtrip Server-Authoritative Operational RPC vs. Client-Side Waterfall

## Status
**Proposed** (Phase G7)

## Context
The Gym Owner Dashboard (`/owner/dashboard`) requires real-time data across 7 distinct subsystems:
- C4/C5 live attendance and completed sessions
- G1 membership counts and attendance streak retention
- G2 community moderation reports and recent posts
- G3 buddy matching opt-ins and active pairs
- G5 active challenges and participant totals
- G6 open safety incidents, critical hazard flags, and active notices

### Considered Alternatives
1. **Option A: Client-Side Waterfall of PostgREST Queries**:
   The front-end executes 7–10 separate `supabase.from(...).select(...)` calls on page load and every 20 seconds of polling.
   - *Drawback*: Connection pool exhaustion, race conditions, partial failure states, and significant network overhead on mobile devices.
2. **Option B: Distributed Edge Function / BFF**:
   A TypeScript Edge Function orchestrates calls across tables.
   - *Drawback*: Adds deployment complexity, cold-start latency, and overhead compared to in-database stored procedures.
3. **Option C: Unified Database Stored Procedure (`get_owner_dashboard_overview`)**:
   A single PostgreSQL `SECURITY DEFINER` function executes all queries within a single transaction in 8–15ms and returns a consolidated JSON document.

## Decision
We adopt **Option C: Unified Database Stored Procedure (`public.get_owner_dashboard_overview(p_gym_id UUID)`)**.

## Consequences
- **Positive**:
  - Single network round-trip for all executive overview cards and alert items.
  - Zero N+1 query overhead.
  - Atomic, consistent snapshot of facility state across all subsystems.
  - Minimal database connection pool usage during 20-second client polling.
- **Negative**:
  - Requires maintaining the SQL aggregation logic in migrations.
