# ADR-003: Emergency SOS & Physical Facility Context Anchoring

**Status:** Approved & Hardened  
**Date:** September 19, 2026  
**Context:** Phase G6 — Gym Safety / SPS  

## Problem
In floor medical crises (e.g. cardiac distress, fainting, severe weight crush), members need a 1-tap distress button. However, remote false alarms or repeated rapid button presses could disrupt gym operations. Furthermore, sensitive member emergency contacts and medical notes must not be openly browseable by gym staff when an athlete is not on premise.

## Decision
We enforce a **Check-In Bound SOS and Dynamic Contact Access Architecture**:
1. **Server-Derived Gym ID**:
   - The client does not supply `p_gym_id`. The server derives `gym_id` from the member's active `gym_attendance_sessions` row (`check_in_at IS NOT NULL AND check_out_at IS NULL`).
   - If not actively checked in, `trigger_gym_emergency_sos()` rejects the call with `40302: Active floor attendance session required`.
2. **15-Minute SOS Deduplication Window**:
   - Repeated clicks within 15 minutes append location details to the existing canonical incident rather than flooding staff with duplicate emergency alerts.
3. **RPC-Only Dynamic Emergency Contact Retrieval**:
   - Direct table `SELECT` on `gym_emergency_contacts` is **DENIED to gym owners**.
   - Staff retrieve contact data exclusively via `get_active_member_emergency_contact(p_user_id, p_gym_id)`.
   - The RPC verifies that the member is **actively checked into that specific facility**.
   - Immediately upon checkout, read access terminates automatically.

## Consequences
- **Positive**: Eliminates remote false alarms; prevents alarm flooding; protects member PII and medical notes from unauthorized surveillance; ensures critical contact availability during physical emergencies.
- **Trade-off**: Requires members to scan QR check-in on arrival to enable 1-tap SOS.
