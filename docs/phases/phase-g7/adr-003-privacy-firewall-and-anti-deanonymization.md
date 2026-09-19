# ADR-003: Operational Security & G6/G4 Privacy Firewall in Dashboard Analytics

## Status
Accepted

## Context
Phase G4 (Peer-to-Peer Chat) and Phase G6 (Safety Incident Whistleblowing & SPS) introduced strict privacy invariants into the system:
1. **G4 Peer Chat**: Chats between gym members are private peer communications. Gym owners have no lawful, technical, or regulatory right to inspect message content, sender/receiver transcripts, or unaggregated communication patterns.
2. **G6 Safety Whistleblowing**: Incident reporters who choose anonymous reporting are protected by strict anonymity contracts (`reporter_id = NULL`, `reporter_name = 'Anonymous Member'`, `reporter_avatar_url = NULL`). Furthermore, sensitive emergency contact details and medical notes must not be leaked into general analytics dashboards or unredacted summaries.

A poorly designed operations dashboard might accidentally violate these boundaries by joining message tables, extracting text snippets, or exposing incident descriptions in high-level metric cards or network responses.

## Decision
1. **Air-Gapped G4 Chat**: No G4 chat tables (`gym_chat_rooms`, `gym_chat_messages`, `gym_chat_participants`) shall be queried or referenced by Phase G7 dashboard services or RPCs. The dashboard will not surface private chat frequency or sentiment.
2. **Strict Numerical Aggregates for G6**: The dashboard RPC `get_owner_dashboard_overview` will ONLY surface integer counts:
   - `open_safety_incidents_count` (integer)
   - `critical_safety_incidents_count` (integer)
   - `active_safety_notices_count` (integer)
   No reporter names, user IDs, incident descriptions, medical notes, or emergency contact access details will be returned in the dashboard overview payload.
3. **Dedicated Workflows**: Detailed investigation of incidents or member roster management remains exclusively inside the dedicated `/owner/safety` and `/owner/members` workflows, which enforce full audit logging (`gym_emergency_contact_access_logs`, incident resolution audit trails).

## Consequences
- **Positive**: Zero risk of de-anonymizing whistleblowers through aggregate analytics or network inspection.
- **Positive**: Zero exposure of member medical or private chat records.
- **Positive**: Complies with GDPR, DPDP Act 2023, and internal security contracts.
