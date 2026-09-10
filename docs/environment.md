# Environment & Secrets Guide — Fitness Platform Phase 1

## 1. Environment Variable Architecture

The project enforces a strict boundary between public browser configuration and server-side secrets.

### Client-Safe Variables (`.env.local`)
These are exposed to the browser bundle by Vite. They MUST have the `VITE_` prefix:
- `VITE_SUPABASE_URL`: `https://zmfwtidtilghminwirjx.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_qhgrBeVEFS70VsXUrQ-8XA_Ds2w8hxu` (Safe for browser; protected by PostgreSQL RLS).
- `VITE_APP_ENV`: `development` | `staging` | `production`.
- `VITE_FIREBASE_API_KEY`: Client web delivery key.
- `VITE_FIREBASE_AUTH_DOMAIN`: `gymbuddy-da185.firebaseapp.com`.
- `VITE_FIREBASE_PROJECT_ID`: `gymbuddy-da185`.
- `VITE_FIREBASE_STORAGE_BUCKET`: `gymbuddy-da185.firebasestorage.app`.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: `1099347517125`.
- `VITE_FIREBASE_APP_ID`: `1:1099347517125:web:b6fc7e34bc85cabfa65aac`.
- `VITE_FIREBASE_MEASUREMENT_ID`: `G-CL2M0KZCXK`.

### Server-Only Secrets (Supabase Secrets Vault ONLY)
These MUST NEVER have a `VITE_` prefix, must never be committed to git, and must never be referenced inside `src/`:
- `SUPABASE_SECRET_KEY`: Privileged key used exclusively in Supabase Edge Functions.
- `AI_PROVIDER_API_KEY`: Secret API key for the LLM provider used in Edge Functions.
- `APP_SECRET_KEY`: Internal server token signing key.

---

## 2. Automated Secret Scanning Guard

Run the automated scanner before committing or deploying:
```bash
npm run audit:secrets
```
The scanner checks `src/`, `public/`, `dist/`, and `.env.local` to guarantee that no privileged secret (`sb_secret_`, `service_role`, private keys) leaks into frontend code or version control.

1. Verify `.env` is listed in `.gitignore`.
2. Ensure `.env.example` contains variable names only without values.
3. Check `git status` before committing to ensure no credentials or certificate files are staged.
4. If a secret is committed by mistake, immediately rotate the key in the external dashboard.
