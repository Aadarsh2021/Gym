# ADR-002: Append-Only Safety Incident Audit Ledger

**Status:** Approved & Hardened  
**Date:** September 19, 2026  
**Context:** Phase G6 — Gym Safety / SPS  

## Problem
In legal liability disputes, insurance claims, or investigations following gym floor injuries, safety records and resolution timelines must be tamper-proof. If status updates overwrite existing fields directly or if records can be deleted, evidence can be destroyed or disputed.

## Decision
We enforce an **Immutable Append-Only Audit Architecture**:
1. **Direct Mutation Denied**:
   - `INSERT`, `UPDATE`, and `DELETE` on `gym_safety_incident_logs` are blocked for all client roles via `USING (FALSE)` and `WITH CHECK (FALSE)`.
2. **Atomic Trigger / RPC Append**:
   - Only system transactions within `SECURITY DEFINER` stored procedures (`report_gym_safety_incident`, `update_safety_incident_status`) can append log records.
3. **No Cascading Deletion (`ON DELETE RESTRICT`)**:
   - Foreign key constraint on `incident_id` uses `ON DELETE RESTRICT`.
   - Even if a direct delete on `gym_safety_incidents` were attempted, PostgreSQL would strictly reject it because audit records exist.
4. **Permanent Retention**:
   - Table `gym_safety_incidents` has an explicit `DELETE` denial policy `USING (FALSE)`.

## Consequences
- **Positive**: Complete forensic defensibility for liability, compliance, and insurance; zero possibility of evidence destruction by staff or rogue actors.
- **Trade-off**: Storage volume grows linearly with incidents (minimal impact due to compact row structure).
