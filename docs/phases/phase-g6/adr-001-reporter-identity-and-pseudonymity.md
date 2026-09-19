# ADR-001: Safety Incident Reporter Identity & Pseudonymity

**Status:** Approved & Hardened  
**Date:** September 19, 2026  
**Context:** Phase G6 — Gym Safety / SPS  

## Problem
In a physical fitness facility, members reporting dangerous equipment, harassment, or staff misconduct need absolute protection against retaliation. If gym owners have direct table `SELECT` privileges on `gym_safety_incidents`, PostgreSQL RLS cannot mask individual columns (like `reporter_id`), risking accidental exposure of whistleblower identities via PostgREST, network inspection, or filtering probes.

## Decision
We enforce a **Zero-Trust Table Privacy Architecture**:
1. **Direct Table SELECT on `gym_safety_incidents` is Denied to Facility Owners**:
   - Table RLS policy allows `SELECT` **ONLY** where `reporter_id = auth.uid()`.
   - Owners cannot query the table directly via PostgREST. Any direct table query returns 0 rows.
2. **Owner Ingress via `SECURITY DEFINER` RPC Only**:
   - Facility owners triage incidents exclusively through `public.get_gym_safety_incidents()`.
   - For anonymous reports (`is_anonymous = true`), the query projection forces:
     - `reporter_id = NULL`
     - `reporter_name = 'Anonymous Member'`
     - `reporter_avatar_url = NULL`
   - The raw `reporter_id` UUID never enters the output projection or client bundle.
3. **Database Identity Retention for Abuse Defense**:
   - The database stores `reporter_id` internally to enforce membership verification and rate-limiting (max 5 reports/hour).
4. **Reported Party Absolute Invisibility**:
   - Accused members named in reports have zero SELECT privileges on safety incidents.

## Consequences
- **Positive**: Complete whistleblower protection; mathematical impossibility of owner deanonymization via direct table queries or filters; abuse rate-limiting remains intact.
- **Trade-off**: Owners cannot message anonymous whistleblowers directly; communication is mediated via status tracking and resolution notes.
