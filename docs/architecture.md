# System Architecture — Fitness Platform Phase 1

## 1. High-Level Architecture Overview

Phase 1 of the Fitness Platform is architected as a **secure, local-first modular monolith / serverless system** optimized for consumer activation, organic retention, and fast mobile performance.

```text
                               INTERNET (HTTPS)
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │      Firebase Hosting     │
                        │    Global CDN & Web SPA   │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │     Consumer Frontend     │
                        │   React 18 + TS (Vite)    │
                        │  Mobile-First Workout UX  │
                        └─────────────┬─────────────┘
                                      │
                                      │ Authenticated Sessions
                                      │ (JWT with auth.uid)
                                      ▼
                        ┌───────────────────────────┐
                        │    Supabase PostgreSQL    │
                        │  Row Level Security (RLS) │
                        │   Deterministic Domain    │
                        │   Atomic RPC Functions    │
                        └─────────────┬─────────────┘
                                      │
                                      │ Server Boundary
                                      ▼
                        ┌───────────────────────────┐
                        │   Supabase Edge Function  │
                        │      (guru-ji-coach)      │
                        │      Prompt Injection     │
                        │          Defense          │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │        AI Provider        │
                        │   Advisory Advice Only    │
                        └───────────────────────────┘
```

---

## 2. Trust Boundaries & Separation of Concerns

1. **Browser / Client (Untrusted)**
   - Holds public configuration only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   - All user input is treated as untrusted and strictly validated.
   - Client is never allowed to dictate authoritative state (PRs, streaks, coin balance, or ownership).
2. **Supabase Auth & PostgreSQL (Authoritative Core)**
   - `auth.users.id` is the canonical identity.
   - 100% of user-owned tables enforce PostgreSQL Row Level Security (RLS).
   - Atomic database RPCs execute state changes (e.g. workout completion, streak events, milestone coins) in single transaction blocks.
3. **Privileged Backend Boundary (Supabase Edge Functions)**
   - Server-only secrets (`AI_PROVIDER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are stored in Supabase Secrets Vault and never leaked to the client.
   - `guru-ji-coach` queries minimal scoped context, sanitizes prompts, and validates structured JSON output.
4. **Deterministic Domain Layer (`src/domain/`)**
   - Business calculations (BMR, TDEE, protein targets, 1RM, PR detection, workout generation) are pure TypeScript functions with zero React or LLM dependencies.

---

## 3. Core Domain Modules

- **Auth Domain**: Session restoration, signup, login, password recovery.
- **Profile & Onboarding**: Height, weight, goal, experience, available equipment, dietary preferences, timezone.
- **Exercise Catalog**: Categorized library by movement pattern, difficulty, target muscles.
- **Workout Planning & Generation**: Algorithmic generation of structured splits (Push/Pull/Legs, Upper/Lower, Full Body).
- **Workout Tracker**: Real-time set logging, rep & weight recording, rest timer, draft set persistence.
- **PR & Progress Tracking**: Authoritative calculation of weight PRs, rep PRs, estimated 1RM, and body metrics.
- **Nutrition Engine**: Caloric maintenance/deficit/surplus, macronutrient targets, Indian food catalog, personalized meal plan generation, protein quality analyzer.
- **Consistency & Rewards**: Timezone-aware streak tracking, monthly revive quota (max 3), append-only fitness coin ledger.
- **Guru Ji AI**: Advisory fitness coach operating behind a secure edge function with prompt injection defense.
- **In-App Notifications**: Workout reminder preferences, alarm schedules, milestone notifications.
