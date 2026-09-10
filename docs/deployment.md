# Deployment Guide — Fitness Platform Phase 1

## 1. Hosting Architecture

- **Frontend Hosting**: Firebase Hosting (Global CDN, fast edge delivery, automatic SSL).
- **Backend & Database**: Supabase PostgreSQL + Auth + Edge Functions.

---

## 2. Step-by-Step Deployment Workflow

### 1. Build Verification
Before deploying, execute the local quality gates:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
This produces an optimized production bundle in `dist/`.

### 2. Firebase CLI Setup & Deployment
Install the Firebase CLI if not present:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting # Select existing project or create new, public directory: dist, single page app: yes
firebase deploy --only hosting
```

### 3. Supabase Edge Functions Deployment
Deploy the privileged server functions:
```bash
supabase functions deploy guru-ji-coach
supabase functions deploy complete-workout
```
Set runtime secrets securely:
```bash
supabase secrets set AI_PROVIDER_API_KEY="your-key-here"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

---

## 3. CI/CD Pipeline Configuration

```text
Git Push (main branch)
    ↓
GitHub Actions / Cloud Build
    ↓
npm install
    ↓
npm run lint & typecheck
    ↓
npm run test (Unit & Security tests)
    ↓
npm run build
    ↓
firebase deploy --only hosting (via FIREBASE_SERVICE_ACCOUNT_TOKEN)
```
