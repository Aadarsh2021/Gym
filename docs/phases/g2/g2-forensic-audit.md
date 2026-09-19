# Phase G2 — Gym Community & Moderation
## Forensic R&D Audit & Technical Implementation Plan

**Date:** September 19, 2026  
**Phase:** G2 — Gym Community & Moderation  
**Scope Status:** Forensic Audit Only (No Code / No Migrations / No Deployment)  
**Parent Phase:** Phase G1 (Gym Retention Foundation — Complete & Verified)

---

## Executive Summary

Phase G2 introduces intra-gym social connectivity and safety to FitBoost GYM V1:
1. **Gym Community Feed & Discussions**: Authoritative, gym-scoped member discussion board with threaded comments.
2. **Community Reporting System**: Member-driven flag/report mechanism with duplicate spam prevention.
3. **Owner Community Moderation Console**: Multi-tenant facility owner moderation queue, content pinning, hiding, and removal.

This audit establishes that **zero community database primitives currently exist** in Supabase. The existing `OwnerCommunityView.tsx` is a 100% static placeholder, while the member experience currently has discovery and broadcasts, but no community discussion board.

### Locked High-Level Scope (3 Tight Features)
* **Feature 1: Gym Community Feed & Comments** (Active members create, view, and comment on intra-gym posts).
* **Feature 2: Community Reporting** (Active members report violations; duplicate reports blocked; audit trail preserved).
* **Feature 3: Owner Moderation Console** (Owners pin posts, hide/remove offending content, and resolve reports for their facility).

---

## 1. Existing Community Repository Audit

Every relevant keyword was searched across `src/`, `supabase/`, `tests/`, and documentation:

| Domain / Keyword | Classification | Location in Codebase | Findings & Evidence |
| :--- | :--- | :--- | :--- |
| **`community`** | **PARTIAL / MOCK** | `src/features/owner/OwnerCommunityView.tsx`, `AppRoutes.tsx:207`, `OwnerAppShell.tsx:53` | Static mock shell. Renders hardcoded stat cards (`Active Posts: 0`, `Pinned Topics: 0`, `Reports / Flagged: 0`) and placeholder copy. Zero backend hooks, queries, or state. |
| **`post` / `posts`** | **NOT IMPLEMENTED** | None | Zero database tables, models, types, or services exist for posts. |
| **`comment` / `comments`** | **NOT IMPLEMENTED** | None | Zero database tables, models, types, or services exist for comments. |
| **`reaction` / `like`** | **NOT IMPLEMENTED** | None | Zero reaction/like tables or counters exist. |
| **`report` / `flag`** | **NOT IMPLEMENTED** | `OwnerSettingsView.tsx:43` | Mentioned only in a notification digest label (`community flag notifications`). Zero database infrastructure. |
| **`moderation`** | **NOT IMPLEMENTED** | `OwnerCommunityView.tsx:9` | Header label only (`MODERATION & FEED`). No moderation logic or tables. |
| **`banned` / `blocked`** | **NOT IMPLEMENTED** | `src/` | No user-blocking or community-banning tables exist. |
| **`announcement`** | **IMPLEMENTED (G1)** | `public.gym_announcements`, `gym.repository.ts`, `OwnerAnnouncementsView.tsx` | Operational G1 feature for one-way owner broadcast notices. Completely distinct from community. |
| **`feed`** | **PARTIAL** | `MemberGymDiscoveryView.tsx` | Facility broadcasts board renders G1 announcements. No community member feed exists. |
| **`realtime`** | **NOT IMPLEMENTED** | None | Zero usage of Supabase Realtime or WebSockets in the repository. |

---

## 2. Current Gym Community Contract

* **Database Schema**: No `gym_posts`, `gym_comments`, or `gym_post_reports` tables exist in any live or historical migration.
* **RPCs**: Zero community stored procedures exist.
* **Repositories / Services**: `gym.repository.ts` contains discovery, memberships, attendance sessions, streaks, announcements, and rewards; it contains zero methods for community posts or moderation.
* **Routing**:
  * `/owner/community` routes to `OwnerCommunityView.tsx` (mock).
  * `/app/gym` routes to `MemberGymDiscoveryView.tsx` (discovery + G1 announcements).
  * No member community route (`/app/gym/community`) currently exists.

---

## 3. Member Eligibility & Multi-Tenancy Boundary

Authoritative membership state is stored in `public.gym_memberships`:
```sql
status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'frozen', 'inactive'))
```

Context resolution is handled in `src/services/gym-context.service.ts` (`deriveMemberGymContext`):

| Membership Status / User Type | Context Mode | Community Feed Access | Posting & Commenting | Reporting Content |
| :--- | :--- | :--- | :--- | :--- |
| **Active Connected Member** (`status = 'active'`) | `integrated` | **YES** (Read own gym feed) | **YES** (Create posts/comments) | **YES** (Report violations) |
| **Pending Member** (`status = 'pending'`) | `home` / `non_integrated` | **NO** (Denied) | **NO** (Denied) | **NO** (Denied) |
| **Frozen Member** (`status = 'frozen'`) | `home` / `non_integrated` | **YES (Read-only)** | **NO** (Cannot post/comment) | **YES** |
| **Inactive / Cancelled** (`status = 'inactive'`) | `home` / `non_integrated` | **NO** (Denied) | **NO** (Denied) | **NO** (Denied) |
| **Non-Integrated Athlete** (`external_gym` / `home`) | `non_integrated` / `home` | **NO** (No gym affiliation) | **NO** (Denied) | **NO** (Denied) |
| **Facility Owner** (`gyms.owner_id = auth.uid()`) | Owner Console | **YES** (Full moderation) | **YES** (Pin/post announcements) | **YES** (Resolve reports) |

### Cross-Gym Isolation Invariant
* Every query, policy, and RPC is keyed by `gym_id`.
* A member of Gym A **cannot** read, query, insert, comment on, or report any content belonging to Gym B.
* An owner of Gym A **cannot** view, pin, moderate, or resolve reports for Gym B.
* If a member belongs to multiple gyms, context switching resolves `activeGym`, and all community operations execute strictly against the currently selected active gym where their membership is `active`.

---

## 4. Community Data Model Design

Three core tables are required. Zero external dependencies.

```
                    ┌─────────────────┐
                    │      gyms       │
                    └────────┬────────┘
                             │ 1
                             │
                             ├──────────────────────────┐
                             │ *                        │ *
                    ┌────────┴────────┐        ┌────────┴────────┐
                    │    gym_posts    │◄───────┤gym_post_reports │
                    └────────┬────────┘ 1      └────────┬────────┘
                             │                          │ *
                             │ 1                        │
                             │ *                        │
                    ┌────────┴────────┐                 │
                    │  gym_comments   │◄────────────────┘
                    └─────────────────┘ 1
```

### 4.1 Table: `public.gym_posts`
```sql
CREATE TABLE public.gym_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 2000),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMPTZ,
    pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Feed Index:
CREATE INDEX idx_gym_posts_feed 
ON public.gym_posts (gym_id, is_pinned DESC, created_at DESC) 
WHERE status = 'published';

-- Owner Moderation Index:
CREATE INDEX idx_gym_posts_owner_mod
ON public.gym_posts (gym_id, status, created_at DESC);
```

### 4.2 Table: `public.gym_comments`
```sql
CREATE TABLE public.gym_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.gym_posts(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 1000),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
    moderated_at TIMESTAMPTZ,
    moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments Lookup Index:
CREATE INDEX idx_gym_comments_post 
ON public.gym_comments (post_id, created_at ASC) 
WHERE status = 'published';
```

### 4.3 Table: `public.gym_post_reports`
```sql
CREATE TABLE public.gym_post_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    post_id UUID REFERENCES public.gym_posts(id) ON DELETE SET NULL,
    comment_id UUID REFERENCES public.gym_comments(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'hate_speech', 'other')),
    details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Target integrity: must target either a post or a comment
    CONSTRAINT chk_report_target CHECK (
        (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL) OR
        (target_type = 'comment' AND comment_id IS NOT NULL)
    ),
    -- Anti-spam: A member cannot submit duplicate reports on the same post or comment
    CONSTRAINT uq_report_member_post UNIQUE (reporter_id, post_id),
    CONSTRAINT uq_report_member_comment UNIQUE (reporter_id, comment_id)
);

-- Owner Moderation Queue Index:
CREATE INDEX idx_gym_post_reports_queue 
ON public.gym_post_reports (gym_id, status, created_at DESC);
```

### 4.4 Retention & Integrity Rules
* `ON DELETE CASCADE` from `gyms` ensures that when a facility is deleted, its community is cleanly purged.
* `ON DELETE SET NULL` on `gym_post_reports.post_id` and `comment_id` preserves the **audit log** of moderation reports even after offending content is removed.
* No reactions/likes table is recommended for G2.

---

## 5. Community Visibility & RLS Security Rules

### 5.1 `gym_posts` RLS
* **SELECT**:
  * Member: Allowed if user has `active` or `frozen` status in `gym_memberships` for `gym_id` AND `status = 'published'`.
  * Author: Allowed to view their own posts even if `status = 'hidden'`.
  * Owner: Allowed to view ALL posts for gyms where `gyms.owner_id = auth.uid()`.
* **INSERT**:
  * Allowed ONLY if `auth.uid() = author_id` AND user has `status = 'active'` in `gym_memberships` for `gym_id`.
  * Defaults `status = 'published'`, `is_pinned = FALSE`.
* **UPDATE**:
  * Member (Author): Can update only `content` and `updated_at` on their own posts (`author_id = auth.uid()`), provided `status <> 'removed'`. CANNOT modify `gym_id`, `author_id`, `status`, `is_pinned`, or moderation fields.
  * Owner: Full update on `status`, `is_pinned`, `pinned_by`, `moderated_by`, `moderated_at`, `moderation_reason` for gyms they own.
* **DELETE**:
  * Direct physical DELETE revoked. Soft deletion via `status = 'removed'` preserves audit integrity.

### 5.2 `gym_comments` RLS
* **SELECT**:
  * Active/frozen members view `status = 'published'` comments on their gym's posts.
  * Owners view all comments for their gyms.
* **INSERT**:
  * Active members comment where `auth.uid() = author_id` AND parent post exists with `status = 'published'`.
* **UPDATE**:
  * Author can update content; owner can moderate status.
* **DELETE**:
  * Physical DELETE revoked.

### 5.3 `gym_post_reports` RLS
* **SELECT**:
  * Owner ONLY: `EXISTS (SELECT 1 FROM public.gyms g WHERE g.id = gym_post_reports.gym_id AND g.owner_id = auth.uid())`.
  * Reporter: Can view their own submitted reports (`reporter_id = auth.uid()`).
* **INSERT**:
  * Active members ONLY: `auth.uid() = reporter_id` AND user has active membership at `gym_id`.
* **UPDATE / DELETE**:
  * Members: REVOKED.
  * Owner: UPDATE permitted for `status`, `reviewed_by`, `reviewed_at`, `resolution_notes`.

---

## 6. Content Moderation Model

### State Machine
```
   [ User creates post ]
             │
             ▼
        'published' ────────────── (Author edits content)
             │
      ┌──────┴──────┐
      │             │
(Owner hides)   (Author or Owner removes)
      │             │
      ▼             ▼
  'hidden'       'removed' (Terminal / Archived)
      │
(Owner restores)
      │
      ▼
 'published'
```

* **Author Capabilities**:
  * Edit content of published posts.
  * Soft-delete post (`status = 'removed'`).
* **Owner Capabilities**:
  * Pin / Unpin post (`is_pinned = TRUE/FALSE`). Maximum 3 pinned posts per gym.
  * Hide post (`status = 'hidden'`) with reason.
  * Remove post (`status = 'removed'`) with reason.
  * Restore hidden post (`status = 'published'`).
  * Resolve reports (`status = 'action_taken'` or `'dismissed'`).

---

## 7. Reporting Architecture & Spam Prevention

1. **Member Workflow**:
   * Any active member clicking "Report" selects a reason: `spam`, `harassment`, `inappropriate`, `hate_speech`, `other`, with optional 500-character description.
2. **Spam & Flooding Prevention**:
   * Database-level unique constraint `UNIQUE (reporter_id, post_id)` prevents automated report flooding.
   * Attempting to report twice returns `409 Conflict / Already reported`.
3. **Owner Queue**:
   * Reports appear in `/owner/community` under "Pending Moderation Queue".
   * Owner can click:
     * **Take Action**: Automatically sets post to `'removed'` or `'hidden'` and report to `'action_taken'`.
     * **Dismiss**: Leaves post intact and marks report as `'dismissed'`.

---

## 8. Owner Moderation UI Reconstitution (`OwnerCommunityView.tsx`)

The existing static mock at `src/features/owner/OwnerCommunityView.tsx` will be replaced with an operational facility console:
* **Metric Cards (Live Data)**:
  * Active Posts (published posts in the active facility).
  * Pinned Posts (current pinned topics, max 3).
  * Pending Reports (reports requiring moderator review).
* **Two-Tab Interface**:
  1. **Feed Management**: View feed as members see it, with owner action buttons (`Pin/Unpin`, `Hide`, `Remove`, `View Comments`).
  2. **Moderation Queue**: Dedicated report triage list displaying reporter, target excerpt, violation reason, details, and quick "Dismiss" / "Remove Content" buttons.

---

## 9. Realtime vs. Polling Recommendation

* **Audit Finding**: Zero Realtime subscriptions exist anywhere in the application.
* **Recommendation**: **Do NOT introduce Supabase Realtime in G2**.
  * **Rationale**:
    1. Intra-gym community feeds are asynchronous bulletin boards, not high-frequency chat rooms.
    2. Polling on navigation + pull-to-refresh + optimistic local cache invalidation on user actions (posting, commenting, moderating) delivers a crisp, deterministic user experience without open WebSocket connections or battery drain.
    3. Keeps the architecture completely consistent with G1 Announcements, Workouts, and Nutrition.
  * Realtime can be evaluated later in G4 (Personal 1-on-1 Chat).

---

## 10. Pagination & Performance Model

* **Feed Pagination**:
  * Default page size: `15 posts`.
  * Strategy: Keyset cursor pagination based on `(is_pinned DESC, created_at DESC)` or indexed offset pagination.
* **Comment Loading**:
  * Comments are **lazy-loaded on demand** when a user expands a post.
  * Default comment limit: `20 comments` per post.
  * Prevents N+1 database queries on feed load.
* **Compound Feed Query**:
  ```sql
  SELECT p.*, pr.display_name, pr.avatar_url,
         (SELECT count(*) FROM public.gym_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count
  FROM public.gym_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.gym_id = $1 AND p.status = 'published'
  ORDER BY p.is_pinned DESC, p.created_at DESC
  LIMIT 15 OFFSET $2;
  ```

---

## 11. Content Safety & XSS Prevention

* **Pure Text Protocol**: Community posts and comments accept and store plain UTF-8 text. Zero raw HTML parsing.
* **React Native & Web Default Safety**: React renders text nodes with automatic escaping of `<`, `>`, `&`, quotes.
* **No Rich HTML**: Disallow WYSIWYG or markdown HTML injection.
* **Input Sanitization**:
  * `content.trim()` validation.
  * Hard database and client character caps (Posts: 2000, Comments: 1000).
  * URL detection: Pure linkification via safe `rel="noopener noreferrer" target="_blank"` anchors with strict protocol whitelist (`http://`, `https://`). No `javascript:` execution.

---

## 12. Boundary: G1 Announcements vs. G2 Community

| Attribute | G1 Announcements (`gym_announcements`) | G2 Community Feed (`gym_posts`) |
| :--- | :--- | :--- |
| **Authorship** | Gym Owner / Staff ONLY | Any Active Gym Member |
| **Purpose** | Official operational facility broadcasts | Peer-to-peer discussion, workout tips, motivation |
| **Direction** | One-way broadcast (no replies) | Two-way interactive (threaded comments) |
| **Interactivity** | None | Comments, Reporting |
| **UI Location** | Announcement banner on Gym Discovery / Owner Broadcasts | Dedicated Community Board |
| **Lifecycle** | `draft` -> `published` -> `archived` + `expires_at` | `published` -> `hidden` -> `removed` |

---

## 13. Future Buddy Matching (G3) & Personal Chat (G4) Dependencies

G2 establishes the foundational social presence for connected members:
* **Stable Author Identity**: `profiles.id`, `profiles.displayName`, `profiles.avatarUrl`.
* **Intra-Gym Social Affinity**: Members interacting on posts become candidates for G3 Buddy Matching based on common training times, workout environment, and goals.
* **Safety & Moderation Precedent**: The reporting system and moderation actions created in G2 will be extended to report spam buddies in G3 and flag abusive chat messages in G4.

---

## 14. Comprehensive Test Plan Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE G2 TEST SUITE                             │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ Unit & Domain Tests      │ Security & RLS Tests    │ Integration Tests │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ • Post character limits  │ • IDOR author forgery   │ • Feed pagination │
│ • Comment nesting        │ • Cross-gym isolation   │ • Comment toggle  │
│ • State transitions      │ • Moderation field lock │ • Report queue    │
│ • Duplicate report block │ • Frozen member read-only│ • Pin/unpin cap  │
│ • URL sanitize safety    │ • Pending member denial │ • Soft delete     │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

1. **Unit & Domain Tests** (`tests/unit/gym-community.test.ts`):
   * Post creation validation (empty, max 2000 chars).
   * Comment creation validation (empty, max 1000 chars).
   * Report deduplication logic.
   * Moderation state transitions (`published` -> `hidden` -> `removed`).
2. **Security & RLS Isolation Tests** (`tests/security/g2-security-and-rls.test.ts`):
   * User A in Gym A cannot query Gym B posts (multi-tenancy check).
   * Member cannot forge `author_id` to impersonate another athlete.
   * Member cannot forge `is_pinned` or `status = 'hidden'`.
   * Pending / Inactive members receive 403 Forbidden.
   * Frozen members can read but cannot create posts or comments.
   * Owner of Gym A cannot moderate Gym B content.
3. **Regression Tests**:
   * C1 Gym discovery remains functional.
   * C4/C5 Attendance sessions and C7 attendance summary intact.
   * G1 Gym attendance streak, announcements, and rewards intact.
   * Desktop stationary sidebar layout contract verified.

---

## 15. Risks, Ambiguities & Open Decisions

1. **Max Pinned Posts**:
   * *Recommendation*: Cap at maximum 3 pinned posts per facility so the feed header does not push regular discussion below the fold.
2. **Frozen Member Privileges**:
   * *Decision*: Frozen members are granted read-only visibility into the feed, but cannot post or comment until their membership is un-frozen.
3. **Profanity / Word Filter**:
   * *Recommendation*: Avoid heavy client-side regex wordlists in G2 that cause false positives (e.g. "Scunthorpe problem"). Authoritative human owner moderation via the reporting queue is cleaner and aligned with V1 architecture.

---

## 16. Recommended Implementation Order (3 Logical Milestones)

```
  ┌──────────────────────────────────────────────────────────┐
  │ Step 1: Database Migration & Authoritative Schema        │
  │ • Create gym_posts, gym_comments, gym_post_reports       │
  │ • Compound indexes, RLS policies, execute grants         │
  └────────────────────────────┬─────────────────────────────┘
                               │
  ┌────────────────────────────▼─────────────────────────────┐
  │ Step 2: Repository, Services & Unit/Security Tests       │
  │ • gym.repository.ts community methods                    │
  │ • tests/unit/gym-community.test.ts                       │
  │ • tests/security/g2-security-and-rls.test.ts             │
  └────────────────────────────┬─────────────────────────────┘
                               │
  ┌────────────────────────────▼─────────────────────────────┐
  │ Step 3: Member Community Feed & Owner Moderation Console │
  │ • Member Community View (/app/gym/community)             │
  │ • Owner Moderation Queue in OwnerCommunityView.tsx       │
  │ • Stationary sidebar & mobile navigation integration     │
  └──────────────────────────────────────────────────────────┘
```

---

## Conclusion & Next Step
The forensic audit is complete. Zero code, migrations, commits, or deployments have been executed.
We await product owner approval on the implementation plan before initiating Phase G2 execution.
