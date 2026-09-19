# Women-Specific Safety Enhancements — Privacy & Scope Governance

## 1. Scope Boundary & Core Principles
Safety features in this phase adhere to strict software-only constraints and zero-surveillance privacy principles:
- **Zero Continuous Background GPS**: We reject persistent tracking, location histories, or battery-draining GPS polling.
- **Strict User Initiation**: Location or checkout shares are triggered solely by the user's explicit gesture.
- **Zero Privacy Leakage**: Emergency contacts and reporter identities are never exposed to other members, buddy matching, or leaderboards.

## 2. Implemented Capabilities

### A. Safe Departure Protocol & Session Share
- Enables members leaving late-evening workout sessions to share a pre-composed safe checkout confirmation with their saved emergency contact.
- Formats standard messaging intent links (`https://wa.me/?text=...` and `sms:...?body=...`).
- Phone numbers are sanitized to E.164 compatible formats; messages are URI-encoded with fallback handling.

### B. Female-Only & Same-Gender Buddy Matching
- Integrates directly with G3 Buddy Matching preference engine (`preferred_gender_filter = 'same_gender'`).
- Guarantees female members opting into same-gender discovery are matched exclusively with verified female training partners.
- Preserves mutual opt-in rules and daily connection quotas.

### C. G6 SPS Anonymous Reporter Privacy
- Anonymous incident reports persist with `user_id = NULL` and `reporter_name = 'Anonymous Member'`.
- Front-desk triage views can never unmask or correlate anonymous reporters with facility memberships.
