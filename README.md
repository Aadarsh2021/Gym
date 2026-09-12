# 🏋️‍♂️ APEXFIT — Intelligent Strength Training & Nutrition Platform

[![Live Production](https://img.shields.io/badge/Live%20Platform-gymbuddy--da185.web.app-E58A4F.svg)](https://gymbuddy-da185.web.app)
[![Build & Security Status](https://img.shields.io/badge/Security%20Audit-Passing-00F0FF.svg)](#-security-architecture--secret-isolation)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178C6.svg)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Supabase-PostgreSQL%20(23%20Tables)-3ECF8E.svg)](https://supabase.com/)
[![Hosting](https://img.shields.io/badge/Firebase-Hosting-FFCA28.svg)](https://firebase.google.com/)
[![Tests](https://img.shields.io/badge/Vitest-119%20Passed-44CF6C.svg)](#-automated-tests--verification)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A modern, production-grade consumer fitness web application engineered with a **2026 Dark Graphite & Restrained Ember** interface. APEXFIT provides end-to-end training split generation, live gym tracking with rest timers, ICMR-NIN verified Indian nutrition planning, personal record (PR) analytics, and timezone-safe consistency streaks.

🌐 **Live URL**: [https://gymbuddy-da185.web.app](https://gymbuddy-da185.web.app)  
📦 **GitHub Repository**: [https://github.com/Aadarsh2021/Gym.git](https://github.com/Aadarsh2021/Gym.git)

---

## 📑 Table of Contents

- [🎨 Design System & Aesthetics (2026 Modern Dark Graphite)](#-design-system--aesthetics-2026-modern-dark-graphite)
- [🔥 Comprehensive Feature Guide (First to Last)](#-comprehensive-feature-guide-first-to-last)
  - [1. Public Landing & Discovery Experience](#1-public-landing--discovery-experience)
  - [2. Public SEO Calculators & Tools Hub](#2-public-seo-calculators--tools-hub)
  - [3. Authentication & Identity Management](#3-authentication--identity-management)
  - [4. Personalized Biometric Onboarding Wizard](#4-personalized-biometric-onboarding-wizard)
  - [5. Athlete Dashboard & Command Center](#5-athlete-dashboard--command-center)
  - [6. Personalized Workout Routines & Plan Builder](#6-personalized-workout-routines--plan-builder)
  - [7. Exercise Library & Smart Alternative Engine](#7-exercise-library--smart-alternative-engine)
  - [8. Active Workout Tracker & Precision Rest Timer](#8-active-workout-tracker--precision-rest-timer)
  - [9. Personal Record (PR) Engine & Milestone Celebrations](#9-personal-record-pr-engine--milestone-celebrations)
  - [10. Comprehensive Indian Nutrition Hub & ICMR-NIN Food Catalog](#10-comprehensive-indian-nutrition-hub--icmr-nin-food-catalog)
  - [11. Interactive Food Diary & Daily Macro Logger](#11-interactive-food-diary--daily-macro-logger)
  - [12. Complex Mixed Meal Analyzer](#12-complex-mixed-meal-analyzer)
  - [13. Smart Macro Meal Replacement & Swapping System](#13-smart-macro-meal-replacement--swapping-system)
  - [14. Deterministic Multi-Slot Meal Planner](#14-deterministic-multi-slot-meal-planner)
  - [15. Performance Analytics & Interactive Progress Charts](#15-performance-analytics--interactive-progress-charts)
  - [16. Complete Workout Session History Archive](#16-complete-workout-session-history-archive)
  - [17. Timezone-Safe Consistency Streaks & Revive Ledger](#17-timezone-safe-consistency-streaks--revive-ledger)
  - [18. Workout Reminders & Browser Alarms](#18-workout-reminders--browser-alarms)
  - [19. Athlete Profile, Settings & Unit Toggles](#19-athlete-profile-settings--unit-toggles)
  - [20. Guru Ji AI Coach Architecture](#20-guru-ji-ai-coach-architecture)
- [🛠 Tech Stack & Architecture](#-tech-stack--architecture)
- [📊 Database Architecture (23 Relational Tables)](#-database-architecture-23-relational-tables)
- [🔒 Security Architecture & Secret Isolation](#-security-architecture--secret-isolation)
- [🚀 Local Development & Setup](#-local-development--setup)
- [🧪 Automated Tests & Verification](#-automated-tests--verification)
- [🚢 Deployment Pipeline](#-deployment-pipeline)
- [📄 License](#-license)

---

## 🎨 Design System & Aesthetics (2026 Modern Dark Graphite)

APEXFIT is designed with a **2026 Dark Graphite & Restrained Ember** design system, delivering the precision and focus of elite software (such as Linear, Raycast, and Apple Fitness+):

- **Graphite Canvas & Surfaces**:
  - Primary Background: `#0F1012`
  - Secondary / Sidebar Surface: `#141619`
  - Card & Container Surface: `#181A1D`
  - Elevated Popovers & Modals: `#1E2125`
- **Tonal Separation & Clean Borders**:
  - Subtle Borders: `#25282D`
  - Medium Borders: `#30343A`
  - Eliminates heavy glowing borders, metallic gradients, and warm brown skeuomorphism.
- **High-Legibility Slate Typography**:
  - Primary Headlines: `#F2F3F5` (Bricolage Grotesque)
  - Body & Labels: `#A9ADB5` (Inter)
  - Data, Timers, Sets & Weights: `#F2F3F5` (IBM Plex Mono)
- **Restrained Ember Accent (`#E58A4F`)**:
  - Follows a 90% neutral graphite / 10% accent balance.
  - Reserved strictly for primary call-to-actions, active navigation indicators, and current set completion.
- **Celebration Gold (`#D4A857`)**:
  - Reserved exclusively for verified Personal Records, milestone streaks, and confetti celebrations.
- **Responsive Architecture**:
  - **Desktop**: Full-height command-grade sidebar with compact navigation, user badge, and quick actions.
  - **Mobile**: Ergonomic floating glass bottom dock with safe-area insets (`env(safe-area-inset-bottom)`) and minimum 44px touch targets.

---

## 🔥 Comprehensive Feature Guide (First to Last)

Below is the complete, chronological catalog of every feature available in the application:

### 1. Public Landing & Discovery Experience
- **Hero Presentation**: Compelling introduction highlighting intelligent workout splits, real-time tracking, deterministic nutrition, and verified progression.
- **Live Interface Showcase**: Interactive previews of workout generators, set tracking, and macro balances directly on the landing page.
- **Feature Exploration**:
  - **How It Works (`/how-it-works`)**: Comprehensive breakdown of the 4-stage athlete journey (Assessment → Split Generation → Live Session Tracking → Progressive Overload).
  - **Workouts Preview (`/workouts`)**: Public catalog detailing Full Body, Upper/Lower, and Push/Pull/Legs splits.
  - **Nutrition Preview (`/nutrition`)**: Deep-dive into macro science, Indian dietary adaptations, and ICMR-NIN food data.
  - **Pricing Transparency (`/pricing`)**: Clear side-by-side feature comparison between Free and Premium tiers without artificial paywalls.
- **Dynamic SEO Head Engine**: Full OpenGraph, Twitter Cards, meta descriptions, and JSON-LD structured data on all public views.

### 2. Public SEO Calculators & Tools Hub
Standalone, search-engine-optimized fitness calculators accessible without signing in (`/tools`):
- **BMR & TDEE Calculator**: Computes Basal Metabolic Rate and Total Daily Energy Expenditure using the clinical Mifflin-St Jeor equation.
- **1RM Strength Calculator**: Estimates 1-Rep Maximum across Bench Press, Squat, Deadlift, and Overhead Press using both **Epley** and **Brzycki** algorithms.
- **Daily Protein Requirement Calculator**: Determines precise gram targets based on body weight, activity level, and athletic goals (1.6 to 2.4 g/kg).

### 3. Authentication & Identity Management
- **Supabase Auth Engine**: Secure email and password authentication with encrypted session tokens.
- **Google OAuth 2.0 Integration**: 1-click Google Sign-In with seamless callback handling (`/auth/callback`).
- **Forgot & Reset Password Flows**:
  - Request password reset link (`/forgot-password`).
  - Secure token verification and password update (`/reset-password`).
- **Guest / Demo Mode**: Instant access to explore core workouts, exercise databases, and calculators before signing up.
- **Zero-Conflict Persistence**: Built-in 409 conflict avoidance and profile synchronization ensuring flawless account creation.

### 4. Personalized Biometric Onboarding Wizard
Interactive 5-step onboarding flow tailored to real-world fitness variables (`/onboarding`):
1. **Biometrics**: Age, gender, height (cm/ft), weight (kg/lbs), and current activity level.
2. **Primary Goals**: Fat loss, muscle hypertrophy, raw strength, or general cardiovascular health.
3. **Experience Level**: Beginner (< 1 year), Intermediate (1–3 years), Advanced (3+ years).
4. **Equipment Access**: Full Commercial Gym, Dumbbells & Bench Only, or Bodyweight / Home Setup.
5. **Dietary Preferences**: Vegetarian, Non-Vegetarian, Eggetarian, Vegan, or Jain.
- *Automatic Output*: Immediate calculation of daily calorie & protein targets, plus generation of a weekly training routine saved to the database.

### 5. Athlete Dashboard & Command Center
The central hub for authenticated users (`/app`):
- **Today's Mission Card**: Dynamic card highlighting today's scheduled training split (e.g., *Push A: Chest, Delts & Triceps*), exercise count, estimated duration, and a prominent 1-click "Start Workout" launcher.
- **At-a-Glance Stat Row**:
  - 🔥 **Current Streak**: Active training streak count.
  - 🏋️‍♂️ **Workouts Completed**: Lifetime session count.
  - ⚡ **Weekly Volume**: Accumulated tonnage lifted this week.
  - 🥗 **Nutrition Adherence**: Today's logged calories and protein versus daily target.
- **Quick Action Bar**: Fast shortcuts to log food, view workout routines, check personal records, and explore exercises.

### 6. Personalized Workout Routines & Plan Builder
- **Weekly Schedule Matrix (`/app/workouts`)**: Visual breakdown of your active split across Monday through Sunday with designated rest days.
- **Interactive Plan Builder (`/app/plan/builder`)**:
  - Customize workout days (2 to 6 days per week).
  - Select split structures: **Full Body**, **Upper / Lower**, or **Push / Pull / Legs**.
  - Adjust training emphasis (hypertrophy vs. strength).
- **Plan Review & Day Swapping (`/app/plan/review`)**:
  - Inspect exercises, target sets, rep ranges, and rest intervals per day.
  - Regenerate or swap individual training days on demand.

### 7. Exercise Library & Smart Alternative Engine
- **Master Exercise Catalog (`/app/exercises`)**:
  - 50+ thoroughly detailed multi-joint compound and isolation movements.
  - Filterable by target muscle group (Chest, Back, Quads, Hamstrings, Shoulders, Arms, Core) and equipment (Barbell, Dumbbell, Cable, Machine, Bodyweight).
- **Smart Exercise Alternative Engine**:
  - Solves the common gym problem of occupied equipment.
  - Provides biomechanically equivalent substitutes with matching movement patterns and progression schemes (e.g., *Barbell Incline Bench Press ↔ Incline Dumbbell Press ↔ Smith Machine Incline Press*).

### 8. Active Workout Tracker & Precision Rest Timer
A dedicated training instrument designed for real gym sessions (`/app/workouts/active`):
- **Live Set Logging**:
  - Clean table interface per exercise displaying previous weight/reps for progressive overload guidance.
  - Input fields for Weight (kg/lbs), Reps completed, and RPE (Rate of Perceived Exertion, 1–10).
- **One-Tap Checkoff**: Click the set checkbox to mark it complete, instantly recording set data.
- **Circular Precision Rest Timer**:
  - Automatically triggers upon set completion.
  - Visual circular progress ring countdown.
  - Audible chime and mobile vibration upon timer expiry.
  - Controls to add +30s, pause, or skip rest.
- **Session Auto-Save (Draft Protection)**:
  - LocalStorage draft caching guarantees workout progress is never lost if the browser is reloaded or connectivity drops.
- **Add / Remove Sets & Exercises on the Fly**: Freely adjust the workout during your gym session.

### 9. Personal Record (PR) Engine & Milestone Celebrations
- **Automatic 1RM Detection**:
  - Automatically evaluates completed sets against your historical bests using Epley and Brzycki formulas.
  - Flags all-time 1RM personal records on compound movements.
- **Workout Summary Modal**:
  - Displays total session time, total tonnage lifted, total sets completed, and PR achievements.
  - Fires dynamic multi-color celebration confetti upon PR milestones.

### 10. Comprehensive Indian Nutrition Hub & ICMR-NIN Food Catalog
- **Nutritional Science Engine (`/app/nutrition`)**:
  - Calorie and macro targets computed via Mifflin-St Jeor and goal multipliers.
  - Target progress rings for Calories, Protein (g), Carbohydrates (g), and Fats (g).
- **ICMR-NIN Verified Database**:
  - Built upon authentic Indian food composition data from the **National Institute of Nutrition (ICMR)**.
  - Includes Paneer, Dal (Moong, Toor, Chana), Soya Chunks, Chicken Breast, Roti, Brown/White Rice, Eggs, Curd, Fish Curry, Rajma, Chole, Idli, Dosa, Sprouts, and Whey.

### 11. Interactive Food Diary & Daily Macro Logger
- **Multi-Meal Logging**:
  - Four structured meal categories: Breakfast, Lunch, Dinner, and Snacks.
  - Add foods by custom portion size (grams or servings).
- **Live Macro Running Totals**:
  - Real-time updates of consumed calories and macros against daily targets.
  - Visual warning indicators if macros exceed or fall short of optimal ranges.

### 12. Complex Mixed Meal Analyzer
- **Solves the Indian Diet Complexity**:
  - Traditional Indian meals combine gravies, rice, flatbreads, and dairy, making macro calculation challenging.
- **Mixed Meal Analyzer (`/app/nutrition` → Analyzer)**:
  - Deconstructs composite dishes (e.g., *Special North Indian Thali*, *Chicken Biryani with Raita*, *Rajma Chawal with Ghee*) into exact constituent macronutrients, fiber, and caloric values.

### 13. Smart Macro Meal Replacement & Swapping System
- **Intelligent Food Swapping (`/app/nutrition` → Swap Modal)**:
  - When a user wants to change a meal item, the engine calculates exact gram equivalents that preserve identical protein and calorie targets.
  - Strictly respects dietary boundaries (e.g., suggests Tofu or Soya Chunks for a Vegetarian swapping out Paneer, or Greek Yogurt for Eggetarians).

### 14. Deterministic Multi-Slot Meal Planner
- **Automated Daily Meal Generator (`/app/nutrition` → Plan Generator)**:
  - Generates balanced 4-meal and 5-meal athletic daily eating plans.
  - Allocates pre-workout and post-workout nutritional timing slots.
  - Tailored to exact vegetarian, eggetarian, or non-vegetarian preferences.

### 15. Performance Analytics & Interactive Progress Charts
Dedicated visualization suite tracking strength and physical transformation (`/app/progress`):
- **Strength Progress Chart (`StrengthProgressChart.tsx`)**:
  - Interactive SVG time-series chart showing 1RM progression curves across major compound lifts.
- **Volume Load Chart (`VolumeChart.tsx`)**:
  - Weekly and monthly accumulated tonnage (Weight × Reps) to monitor training density and volume.
- **Bodyweight Trend Chart (`WeightTrendChart.tsx`)**:
  - Tracks bodyweight weigh-ins over time with moving average trendlines and net weight delta.
- **Verified Personal Records Table**:
  - Filterable table displaying exercise name, maximum weight, reps achieved, calculated 1RM, and achievement date.

### 16. Complete Workout Session History Archive
- **Historical Session Browser (`/app/progress` → History)**:
  - Chronological timeline of every finished workout session.
  - Expandable session cards displaying duration, exercises performed, sets, weights, and total tonnage.

### 17. Timezone-Safe Consistency Streaks & Revive Ledger
- **Timezone-Aware Consistency Engine**:
  - Evaluates workouts based on the athlete's local calendar day, preventing streak breaks during midnight or travel.
- **Rest Day Shield**:
  - Scheduled rest days do not break active streaks, encouraging sustainable recovery.
- **Fair Streak Revive System**:
  - Provides up to 3 streak revives per calendar month to recover missed sessions due to illness or emergencies.
- **Fitness Coin Ledger**:
  - Reward coins awarded upon reaching consistency milestones (Day 7, Day 30, Day 100).

### 18. Workout Reminders & Browser Alarms
- **Automated Reminder Engine (`reminder.service.ts`)**:
  - Configurable notification schedules (Morning, Afternoon, Evening, or Custom Time).
  - Native browser push notifications and alarms reminding athletes of today's workout.
  - Persistent preference storage in user profile settings.

### 19. Athlete Profile, Settings & Unit Toggles
- **Personal Information Management (`/app/profile`)**:
  - Update age, height, body weight, activity level, and fitness goals at any time.
- **Measurement Preferences**:
  - 1-click toggle between Metric (kg / cm) and Imperial (lbs / ft-in).
- **Security & Session Control**:
  - View authenticated account email, linked auth provider, and execute safe session sign-out.

### 20. Guru Ji AI Coach Architecture
- **Phase 2 Ready Architecture**:
  - Dedicated Supabase Edge Function (`guru-ji-coach`) gateway ready for cultural, context-aware coaching.
  - Built-in prompt injection sanitization, 500-character input limits, and database-level rate limiting (15 queries/hour per user).

---

## 🛠 Tech Stack & Architecture

| Layer | Technology | Role / Security Boundary |
|---|---|---|
| **Frontend UI** | React 18, TypeScript, Vite | High-performance SPA with strict typing |
| **Styling** | Vanilla CSS Design System | Custom tokens, 2026 Dark Graphite theme, zero runtime overhead |
| **Routing** | React Router v7 | Clean declarative routing with auth guards |
| **Data Visualization** | Custom Responsive SVG Charts | Zero-dependency, accessible charts for volume, strength, and weight |
| **Web Hosting** | Firebase Hosting | Ultra-low latency global CDN delivery (`dist/`) |
| **Authentication** | Supabase Auth (GoTrue) | Sole identity provider, JWT sessions, OAuth 2.0 |
| **Database** | Supabase PostgreSQL | 23 authoritative tables, relational foreign keys, indexes |
| **Authorization** | Row Level Security (RLS) | 100% table isolation (`auth.uid()` scoping) |
| **Automated Testing** | Vitest | 119 unit, domain, and security regression tests |
| **Security Auditing** | Custom Node.js Scanner | Pre-build AST scanning preventing secret exposure |

---

## 📊 Database Architecture (23 Relational Tables)

All tables operate under the `public` PostgreSQL schema with Row-Level Security enforced:

```text
├── Authentication & User Identity
│   ├── profiles                        # User metadata, timezone, unit preferences
│   └── fitness_profiles                # Biometrics (height, weight, body fat %, activity)
│
├── Exercise & Workout Catalog
│   ├── exercises                       # Master exercise library with equipment & muscle tags
│   ├── workout_plans                   # Active weekly plan configurations
│   ├── workout_plan_days               # Days within a plan (Push Day, Leg Day, etc.)
│   └── workout_plan_exercises          # Exercises assigned to plan days with target sets/reps
│
├── Workout Sessions & Set Logs
│   ├── workout_sessions                # Logged workout sessions with timestamps
│   ├── workout_session_exercises       # Exercises executed during a specific session
│   └── workout_sets                    # Individual sets (weight, reps, rpe, is_completed)
│
├── Performance & Tracking
│   ├── personal_records                # 1RM PR records per user and exercise
│   └── progress_entries                # Bodyweight, measurements, and progress logs
│
├── Nutrition & Meal Planning
│   ├── foods                           # Reference nutrition catalog (ICMR-NIN verified)
│   ├── food_diary_entries              # Daily logged meals and portion weights
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
├── AI Assistant & Notifications
│   ├── ai_conversations                # Guru Ji chat sessions
│   ├── ai_messages                     # Contextual chat messages
│   └── notifications                   # User alerts, reminders, and milestone notices
```

---

## 🔒 Security Architecture & Secret Isolation

1. **Client Isolation**:
   - Browser code uses **only** `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_URL`.
   - Client bundles **never** contain service role keys, admin keys, or backend secrets.
2. **Automated Secret Scanner**:
   - `scripts/audit-secrets.js` runs automatically during `npm run build`.
   - Scans all files for accidental credential leaks (`sb_secret_`, `service_role`, private keys).
   - Any detected credential immediately aborts the production build.
3. **Row-Level Security (RLS)**:
   - Direct ownership: `auth.uid() = user_id`.
   - Subqueries enforce user ownership on all nested records (sets, sessions, food entries).
   - Master catalogs (exercises, reference foods) allow public read-only access.

---

## 🚀 Local Development & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Firebase CLI** (for hosting deployments): `npm install -g firebase-tools`

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Aadarsh2021/Gym.git
   cd Gym
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the project root:
   ```env
   # Supabase Public Configuration
   VITE_SUPABASE_URL=https://zmfwtidtilghminwirjx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_qhgrBeVEFS70VsXUrQ-8XA_Ds2w8hxu
   VITE_APP_ENV=development

   # Firebase Web Configuration
   VITE_FIREBASE_API_KEY=AIzaSyCgzymmwcbgcPwcm94Wn6Ah9esA7AJqHtg
   VITE_FIREBASE_AUTH_DOMAIN=gymbuddy-da185.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=gymbuddy-da185
   VITE_FIREBASE_STORAGE_BUCKET=gymbuddy-da185.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1099347517125
   VITE_FIREBASE_APP_ID=1:1099347517125:web:b6fc7e34bc85cabfa65aac
   VITE_FIREBASE_MEASUREMENT_ID=G-CL2M0KZCXK
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Automated Tests & Verification

The codebase includes an extensive suite of **119 automated tests** covering pure domain calculations, security constraints, and database persistence:

```bash
# Run all automated tests
npm test

# Run TypeScript strict typecheck
npm run typecheck

# Execute production build with automated secret auditing
npm run build
```

### Verified Test Suites (19 Files / 119 Tests)
- `tests/unit/seo.test.ts` (6 tests) — OpenGraph, meta tags, schema validation
- `tests/unit/workout-generator.test.ts` (5 tests) — Split distribution & exercise volume
- `tests/unit/streak-calculator.test.ts` (5 tests) — Timezone calculations & revive limits
- `tests/unit/progression.test.ts` (4 tests) — Progressive overload & volume increment
- `tests/unit/supabase-409-persistence-regression.test.ts` (12 tests) — Conflict-free profile & plan upserts
- `tests/unit/pr-calculator.test.ts` (3 tests) — Epley & Brzycki 1RM accuracy
- `tests/unit/exercise-alternatives.test.ts` (4 tests) — Equipment-aware exercise swapping
- `tests/unit/calories.test.ts` (5 tests) — Mifflin-St Jeor TDEE math
- `tests/unit/scheduled-workout.test.ts` (7 tests) — Today's workout selector logic
- `tests/unit/workout-persistence.test.ts` (5 tests) — Session saving and retrieval
- `tests/unit/google-auth.test.ts` (18 tests) — OAuth callback and error handling
- `tests/security/idempotency.test.ts` (3 tests) — Duplicate prevention
- `tests/security/rls-isolation.test.ts` (5 tests) — Cross-user data isolation
- `tests/unit/protein.test.ts` (3 tests) — Protein gram per kg distribution
- `tests/security/idor-defense.test.ts` (3 tests) — IDOR protection checks
- `tests/unit/reminders.test.ts` (12 tests) — Notification persistence and alarm scheduling
- `tests/unit/progress-charts.test.ts` (4 tests) — Volume, 1RM, and weight data aggregation
- `tests/unit/mixed-meal-and-replacement.test.ts` (12 tests) — Mixed meal deconstruction & swaps
- `tests/unit/food-diary.test.ts` (3 tests) — Daily meal logging & macro math

---

## 🚢 Deployment Pipeline

### Automated Continuous Deployment (GitHub Actions)
Pushes to the `main` branch automatically trigger `.github/workflows/firebase-deploy.yml`:
1. Installs dependencies (`npm ci`).
2. Runs TypeScript type-check (`npm run typecheck`).
3. Compiles the production bundle with secret auditing (`npm run build`).
4. Deploys directly to Firebase Hosting CDN.

### Manual One-Command Deployment
```bash
# Build & deploy hosting directly via Firebase CLI
npm run deploy
```

Live Production Site: **[https://gymbuddy-da185.web.app](https://gymbuddy-da185.web.app)**

---

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
