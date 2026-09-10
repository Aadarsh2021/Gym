# 🏋️‍♂️ Consumer-First Fitness Platform (Phase 1 MVP)

[![Build & Security Status](https://img.shields.io/badge/Build%20%26%20Security%20Audit-Passing-00F0FF.svg)](#security-architecture)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178C6.svg)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Supabase-PostgreSQL%20(23%20Tables)-3ECF8E.svg)](https://supabase.com/)
[![Hosting](https://img.shields.io/badge/Firebase-Hosting-FFCA28.svg)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A production-grade, local-first consumer fitness web platform engineered to acquire, guide, and retain individual fitness consumers organically without reliance on trainers, gyms, paid ads, or network effects.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Features](#-key-features)
- [Tech Stack & Security Boundary](#-tech-stack--security-boundary)
- [Database Schema (23 Authoritative Tables)](#-database-schema-23-authoritative-tables)
- [Security Architecture & Secret Isolation](#-security-architecture--secret-isolation)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Local Development](#local-development)
  - [Automated Tests & Quality Checks](#automated-tests--quality-checks)
- [Production Deployment](#-production-deployment)
  - [Supabase Migrations & Database Setup](#supabase-migrations--database-setup)
  - [Supabase Edge Functions Deployment](#supabase-edge-functions-deployment)
  - [Firebase Hosting Deployment](#firebase-hosting-deployment)
- [Project Directory Structure](#-project-directory-structure)

---

## 🏛 Architectural Overview

The application follows a **Server-Authoritative, Local-First Modular Architecture**:

```mermaid
graph TD
    User([User Browser / Client])
    
    subgraph Frontend Delivery
        FB[Firebase Hosting CDN]
        App[React 18 + Vite SPA]
    end

    subgraph Supabase Cloud
        Auth[Supabase Auth (Sole Identity Provider)]
        PG[(PostgreSQL Database)]
        RLS{Row-Level Security Policies}
        RPC[Stored Procedures & Triggers]
        Edge[Supabase Edge Functions]
    end

    subgraph External Services
        AI[AI Provider Gateway]
    end

    User -->|Static Assets| FB
    FB --> App
    App -->|Publishable Key + User JWT| Auth
    Auth -->|Authenticated Session| App
    App -->|Standard Queries with JWT| RLS
    RLS --> PG
    App -->|Atomic Completion| RPC
    RPC --> PG
    App -->|AI Advice Request| Edge
    Edge -->|Server Secret| AI
    Edge -->|Scoped User Context| PG
```

### Core Architectural Decisions:
1. **Supabase Auth as the Sole Identity Provider**: Firebase Auth is **never** initialized. User accounts, JWT issuance, and authentication sessions live strictly in Supabase Auth.
2. **Database as Single Source of Truth**: Metrics such as 1RM personal records, active daily streaks, and fitness coin rewards are verified and calculated atomically inside PostgreSQL triggers/RPCs, not in untrusted browser code.
3. **Deterministic Domain Engine**: Algorithmic workout split generation, calorie calculations (Mifflin-St Jeor), protein targets (1.6–2.4 g/kg), and streak rules are isolated in pure TypeScript modules (`src/domain/`) with 100% test coverage.
4. **Zero-Trust Client Boundary**: Client bundles only contain public configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and public Firebase web configs). Privileged API secrets are restricted to Edge Function environments.

---

## ⚡ Key Features

### 1. Personalized Biometric Onboarding
- Multi-step onboarding collecting age, gender, height, weight, fitness goals, workout frequency, and equipment access (Gym, Dumbbells, Bodyweight).
- Indian dietary preference support (Vegetarian, Non-Vegetarian, Eggetarian, Vegan, Jain).
- Automatic generation of custom weekly workout and nutrition plans.

### 2. Algorithmic Workout Generator
- Deterministic workout split engine supporting **Full Body**, **Upper / Lower**, and **Push / Pull / Legs** routines.
- Tailored exercise selection with muscle group balance, progression tags, and equipment filters.

### 3. Active Workout Tracker & Rest Timer
- Real-time set logging with completed set checkboxes, weight, reps, and RPE indicators.
- Live countdown rest timer with visual circular progress, audio chime, and mobile vibration feedback.
- LocalStorage draft auto-save preventing data loss during browser refreshes or connectivity drops.
- Atomic `complete_workout_session` PostgreSQL RPC invocation upon finish.

### 4. Progress Tracking & Personal Records (PR)
- Epley and Brzycki 1RM (One-Rep-Max) calculations.
- Automatic PR milestone detection on bench press, squats, deadlifts, and overhead presses.
- Downloadable/shareable canvas-rendered PR celebration cards.

### 5. Timezone-Aware Streaks & Fitness Coins
- Timezone-safe streak counter with rest-day protection and same-day duplicate logging prevention.
- Fair streak revive mechanic enforcing a maximum quota of 3 revives per calendar month.
- Milestone-based Fitness Coin ledger (Day 7, Day 30, Day 100 rewards).

### 6. Indian Nutrition Hub & ICMR-NIN Catalog
- Mifflin-St Jeor Total Daily Energy Expenditure (TDEE) and caloric target calculations.
- Macro distribution (protein, carbs, fats) tailored to fitness goals.
- Verified database of common Indian foods (Paneer, Dal, Soya Chunks, Chicken Curry, Roti, etc.) based on **ICMR-NIN (National Institute of Nutrition, India)** research data.

### 7. Guru Ji AI Fitness Coach
- Context-aware coaching powered by Supabase Edge Functions.
- Strict prompt injection defenses, input character caps (500 chars), and database-backed rate limiting (15 queries/hour per user).
- Actionable, empathetic, and culturally-relevant fitness advice without hallucinations.

### 8. Public SEO Utility Calculators
- Standalone, indexable web calculators:
  - **BMR & TDEE Calculator**
  - **Epley 1RM Calculator**
  - **Daily Protein Requirement Calculator**

---

## 🛠 Tech Stack & Security Boundary

| Layer | Technology | Role / Security Boundary |
|---|---|---|
| **Frontend UI** | React 18, TypeScript, Vite | Fast, typed, modular single-page client |
| **Styling** | Custom Vanilla CSS | CSS variables, responsive design tokens, dark mode |
| **Web Hosting** | Firebase Hosting | Global CDN static delivery (`dist/`) |
| **Authentication** | Supabase Auth (GoTrue) | JWT issuance, OAuth / Email-Password identity |
| **Production Database** | Supabase PostgreSQL | 23 relational tables, relational constraints, indices |
| **Authorization** | Supabase Row Level Security | 100% table isolation (`auth.uid()` scoping) |
| **Server Operations** | Supabase Edge Functions (Deno) | AI gateway, rate limiting, server-authoritative APIs |
| **Unit / Security Tests** | Vitest | Deterministic domain logic and security invariant tests |

---

## 📊 Database Schema (23 Authoritative Tables)

All tables are created under the `public` schema in Supabase with RLS enabled:

```text
├── Authentication & User Identity
│   ├── profiles                        # Primary user metadata, timezone, experience
│   └── fitness_profiles                # Biometrics (height, weight, body fat %, activity)
│
├── Exercise & Workout Catalog
│   ├── exercises                       # Master exercise library with equipment & muscle tags
│   ├── workout_plans                   # Generated weekly plan configurations
│   ├── workout_plan_days               # Days within a plan (e.g., Push Day, Leg Day)
│   └── workout_plan_exercises          # Exercises assigned to plan days with target sets/reps
│
├── Workout Sessions & Set Logs
│   ├── workout_sessions                # Logged workout sessions with start/end times
│   ├── workout_session_exercises       # Exercises executed during a specific session
│   └── workout_sets                    # Individual sets (weight, reps, rpe, is_completed)
│
├── Performance & Tracking
│   ├── personal_records                # 1RM PR records per user and exercise
│   └── progress_entries                # Bodyweight, measurements, and progress logs
│
├── Nutrition & Meal Planning
│   ├── foods                           # Reference nutrition catalog (ICMR-NIN verified)
│   ├── nutrition_profiles              # Calorie & macro targets (protein, carbs, fats)
│   ├── meal_plans                      # Custom user meal plans
│   └── meal_plan_items                 # Food items with portion grams per meal
│
├── Engagement, Streaks & Gamification
│   ├── streaks                         # Active streak, longest streak, last workout date
│   ├── streak_events                   # Append-only log of streak events (completed, frozen)
│   ├── streak_revives                  # Monthly revive quota ledger (max 3/month)
│   ├── achievements                    # Milestone definitions
│   └── fitness_coins                   # Coin transaction ledger (earning & spending)
│
├── AI Assistant & Communication
│   ├── ai_conversations                # Guru Ji chat sessions
│   ├── ai_messages                     # Contextual chat messages (user & assistant)
│   └── notifications                   # User alerts, reminders, and milestone notices
```

---

## 🔒 Security Architecture & Secret Isolation

This repository strictly complies with zero-trust client security standards:

1. **Client Isolation**:
   - `src/lib/supabase.ts` uses **only** `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_URL`.
   - Browser code **never** accesses `SUPABASE_SECRET_KEY`, `service_role`, or AI provider keys.
2. **Automated Secret Scanner**:
   - `scripts/audit-secrets.js` runs automatically during `npm run build`.
   - Scans `src/`, `public/`, `dist/`, and `.env*` files for accidental credential leaks (`sb_secret_`, `service_role`, private keys, API keys).
   - If any forbidden secret is detected, the build process exits with code 1.
3. **Row-Level Security (RLS)**:
   - Direct ownership: `auth.uid() = user_id`.
   - Indirect ownership: Subqueries verifying user ownership of parent sessions/plans.
   - Reference catalogs: Public `SELECT` allowed; modifications restricted to service role.
4. **Privileged Edge Boundary**:
   - Edge Functions authenticate requests using the caller's JWT (`auth.uid()`).
   - Rate limiting is enforced at the database level before forwarding requests to external AI APIs.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase CLI** (optional, for local migration management): `npm install -g supabase`
- **Firebase CLI** (optional, for deployment): `npm install -g firebase-tools`

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Aadarsh2021/Gym.git
   cd Gym
   ```

2. Copy the example environment template:
   ```bash
   cp .env.example .env.local
   ```

3. Populate `.env.local` with your public browser credentials:
   ```env
   # Supabase Public Configuration
   VITE_SUPABASE_URL=https://zmfwtidtilghminwirjx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_qhgrBeVEFS70VsXUrQ-8XA_Ds2w8hxu
   VITE_APP_ENV=development

   # Firebase Web Delivery Configuration
   VITE_FIREBASE_API_KEY=AIzaSyCgzymmwcbgcPwcm94Wn6Ah9esA7AJqHtg
   VITE_FIREBASE_AUTH_DOMAIN=gymbuddy-da185.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=gymbuddy-da185
   VITE_FIREBASE_STORAGE_BUCKET=gymbuddy-da185.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1099347517125
   VITE_FIREBASE_APP_ID=1:1099347517125:web:b6fc7e34bc85cabfa65aac
   VITE_FIREBASE_MEASUREMENT_ID=G-CL2M0KZCXK
   ```

### Local Development

Install dependencies and start the Vite development server:
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Automated Tests & Quality Checks

Run the Vitest test suite (includes domain calculations, IDOR defenses, and RLS checks):
```bash
npm test
```

Run TypeScript strict type checking:
```bash
npm run typecheck
```

Run the production build with automated secret auditing:
```bash
npm run build
```

---

## 🌐 Production Deployment

### Supabase Migrations & Database Setup
Deploy the 23-table schema, RLS policies, functions, and seed data to your Supabase project (`zmfwtidtilghminwirjx`):

```bash
# Using the Supabase CLI
supabase link --project-ref zmfwtidtilghminwirjx
supabase db push
```

*Or manually run the SQL files in order within the Supabase SQL Editor:*
1. `supabase/migrations/20260910000001_initial_schema.sql` (23 tables, indexes)
2. `supabase/migrations/20260910000002_rls_policies.sql` (RLS security policies)
3. `supabase/migrations/20260910000003_functions_triggers.sql` (Atomic RPCs, user trigger)
4. `supabase/seed.sql` (Exercises & ICMR-NIN Indian food catalog)

### Supabase Edge Functions Deployment
Deploy the `guru-ji-coach` serverless function and configure runtime secrets:

```bash
# 1. Set server secrets (DO NOT expose these to Vite)
supabase secrets set --project-ref zmfwtidtilghminwirjx \
  SUPABASE_SECRET_KEY="<your-rotated-supabase-secret-key>" \
  AI_PROVIDER_API_KEY="<your-ai-api-key>"

# 2. Deploy the function
supabase functions deploy guru-ji-coach --project-ref zmfwtidtilghminwirjx
```

### Firebase Hosting Deployment
Deploy the compiled client bundle to Firebase Hosting (`gymbuddy-da185`):

```bash
# 1. Authenticate with Firebase
firebase login

# 2. Build the production application
npm run build

# 3. Deploy hosting assets
firebase deploy --only hosting
```
Your application will be live at `https://gymbuddy-da185.web.app`.

---

## 📂 Project Directory Structure

```text
├── .firebaserc                     # Firebase project configuration (gymbuddy-da185)
├── firebase.json                   # Firebase Hosting SPA rewrite configuration
├── .gitignore                      # Strict Git exclusion for .env, build artifacts & secrets
├── .env.example                    # Clean environment configuration template
├── package.json                    # Dependencies & build/test scripts
├── tsconfig.json                   # Strict TypeScript compiler options & @/* path aliases
├── vite.config.ts                  # Vite build tool and chunk-splitting configuration
├── scripts/
│   └── audit-secrets.js            # Automated pre-build secret scanning script
├── src/
│   ├── components/
│   │   ├── layout/                 # Header, BottomNav, Footer
│   │   └── ui/                     # Button, Card, Modal, Input, Badge
│   ├── domain/                     # Deterministic pure business logic
│   │   ├── calories.ts             # BMR & TDEE calculation formulas
│   │   ├── protein.ts              # Protein & macro split engines
│   │   ├── pr-calculator.ts        # Epley & Brzycki 1RM calculators
│   │   ├── streak-calculator.ts    # Timezone-aware streak & revive rules
│   │   └── workout-generator.ts    # Algorithmic workout split generator
│   ├── features/                   # Core application views
│   │   ├── auth/                   # Supabase Auth modal (Login / Signup)
│   │   ├── onboarding/             # Interactive biometrics onboarding wizard
│   │   ├── dashboard/              # Today's action plan & workout launcher
│   │   ├── workout-tracker/        # Real-time set tracker & rest timer
│   │   ├── progress/               # Verified PRs & shareable celebration cards
│   │   ├── nutrition/              # Macro overview & ICMR-NIN Indian food explorer
│   │   ├── streaks/                # Streak timeline & Fitness Coin ledger
│   │   ├── guru-ji/                # Edge-powered AI fitness coach drawer
│   │   └── seo-pages/              # Standalone public BMR/1RM/Protein calculators
│   ├── lib/
│   │   ├── supabase.ts             # Browser-safe Supabase client (Publishable key)
│   │   ├── firebase.ts             # Firebase client for delivery & analytics
│   │   └── logger.ts               # Privacy-sanitized client logging utility
│   ├── styles/                     # Vanilla CSS design system
│   │   ├── variables.css           # Color tokens, fonts, spacing, shadows
│   │   ├── typography.css          # Inter & Outfit font hierarchies
│   │   ├── layout.css              # Grid & flex containers
│   │   ├── components.css          # Reusable component classes
│   │   └── animations.css          # Subtle micro-interactions & transitions
│   └── types/                      # Authoritative TypeScript database & domain types
├── supabase/
│   ├── migrations/                 # PostgreSQL DDL, RLS, functions & triggers
│   │   ├── 20260910000001_initial_schema.sql
│   │   ├── 20260910000002_rls_policies.sql
│   │   └── 20260910000003_functions_triggers.sql
│   ├── functions/
│   │   └── guru-ji-coach/          # Serverless Edge Function (AI boundary)
│   └── seed.sql                    # Master exercise and Indian nutrition datasets
└── tests/
    ├── unit/                       # Unit tests for domain logic
    └── security/                   # IDOR, RLS isolation, and idempotency tests
```

---

## 📄 License
This project is licensed under the MIT License.
