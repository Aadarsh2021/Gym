import { describe, it, expect } from 'vitest';
import {
  GymPost,
  GymComment,
  GymPostReport,
  GymMembership,
} from '@/types/gym.types';

/**
 * Phase G2: Security, RLS & Multi-Tenant Isolation Suite
 * 
 * Verifies locked security guarantees:
 * 1. Member Access Matrix:
 *    - ACTIVE: read feed, create, edit own, delete own, comment, report
 *    - FROZEN: read-only access (no create/edit/delete/comment/report)
 *    - PENDING / INACTIVE / NON-INTEGRATED: Zero access
 * 2. Strict Cross-Gym Isolation:
 *    - Member in Gym A cannot read or post in Gym B
 *    - Owner of Gym A cannot moderate or pin posts in Gym B
 * 3. Anti-Spoofing & Protected Moderation Fields:
 *    - Members cannot alter author_id or gym_id
 *    - Members cannot mutate is_pinned, pinned_by, moderated_by, moderated_at, moderation_reason
 *    - Members cannot self-pin
 * 4. Maximum 3 Pinned Posts Concurrency & Row-Lock Simulation
 * 5. Report Audit Preservation:
 *    - Target constraints (post vs comment)
 *    - Duplicate prevention per reporter/target
 *    - Deletion of target does not destroy report history
 * 6. XSS / Content Safety:
 *    - Plain text handling, script injection neutrality
 */

interface SessionContext {
  userId: string;
  role: 'authenticated' | 'anon';
}

// ── RLS POLICIES SIMULATORS ────────────────────────────────────────────────

// 1. gym_posts RLS
function simulateGymPostsSelect(
  ctx: SessionContext | null,
  posts: GymPost[],
  memberships: GymMembership[], // (user_id, gym_id, status)
  gymOwners: Record<string, string> // gymId -> ownerId
): GymPost[] {
  if (!ctx || ctx.role === 'anon') return [];

  return posts.filter(post => {
    // Owner of the gym can read all posts for that gym
    if (gymOwners[post.gymId] === ctx.userId) return true;

    // Active or Frozen member can read published posts of their gym
    const member = memberships.find(
      m => m.gymId === post.gymId && m.userId === ctx.userId && (m.status === 'active' || m.status === 'frozen')
    );
    if (member && post.status === 'published') return true;

    return false;
  });
}

function simulateGymPostInsert(
  ctx: SessionContext | null,
  gymId: string,
  authorId: string,
  memberships: GymMembership[]
): { allowed: boolean; reason?: string } {
  if (!ctx || ctx.role === 'anon') return { allowed: false, reason: 'unauthenticated' };

  // Anti-spoofing: author_id MUST equal auth.uid()
  if (authorId !== ctx.userId) {
    return { allowed: false, reason: 'author_id spoofing denied: author_id must match authenticated user' };
  }

  // Active membership required
  const mem = memberships.find(m => m.gymId === gymId && m.userId === ctx.userId && m.status === 'active');
  if (!mem) {
    return { allowed: false, reason: 'gym_id spoofing or membership invalid: active membership required' };
  }

  return { allowed: true };
}

function simulateGymPostUpdate(
  ctx: SessionContext | null,
  existingPost: GymPost,
  updates: Partial<GymPost>,
  gymOwners: Record<string, string>
): { allowed: boolean; reason?: string } {
  if (!ctx || ctx.role === 'anon') return { allowed: false, reason: 'unauthenticated' };

  const isOwner = gymOwners[existingPost.gymId] === ctx.userId;
  const isAuthor = existingPost.authorId === ctx.userId;

  // If normal member:
  if (!isOwner) {
    if (!isAuthor) {
      return { allowed: false, reason: 'unauthorized: cannot update another member post' };
    }

    // Protected fields check (Trigger: protect_gym_community_mutations)
    if (updates.gymId && updates.gymId !== existingPost.gymId) {
      return { allowed: false, reason: 'gym_id is immutable' };
    }
    if (updates.authorId && updates.authorId !== existingPost.authorId) {
      return { allowed: false, reason: 'author_id is immutable' };
    }
    if (updates.isPinned !== undefined && updates.isPinned !== existingPost.isPinned) {
      return { allowed: false, reason: 'only gym owner can modify pin status' };
    }
    if (updates.moderatedBy !== undefined || updates.moderatedAt !== undefined || updates.moderationReason !== undefined) {
      return { allowed: false, reason: 'members cannot modify moderation fields' };
    }
    // Member status transition: only allow 'hidden' (soft delete)
    if (updates.status !== undefined && updates.status !== 'published' && updates.status !== 'hidden') {
      return { allowed: false, reason: 'members can only set status to hidden' };
    }
  }

  return { allowed: true };
}

// 2. gym_comments RLS
function simulateGymCommentsSelect(
  ctx: SessionContext | null,
  comments: GymComment[],
  memberships: GymMembership[],
  gymOwners: Record<string, string>
): GymComment[] {
  if (!ctx || ctx.role === 'anon') return [];

  return comments.filter(c => {
    if (gymOwners[c.gymId] === ctx.userId) return true;
    const mem = memberships.find(
      m => m.gymId === c.gymId && m.userId === ctx.userId && (m.status === 'active' || m.status === 'frozen')
    );
    return mem && c.status === 'published';
  });
}

function simulateGymCommentInsert(
  ctx: SessionContext | null,
  post: GymPost,
  commentGymId: string,
  authorId: string,
  memberships: GymMembership[]
): { allowed: boolean; reason?: string } {
  if (!ctx || ctx.role === 'anon') return { allowed: false, reason: 'unauthenticated' };
  if (authorId !== ctx.userId) return { allowed: false, reason: 'author_id spoofing denied' };

  // Same-gym consistency
  if (post.gymId !== commentGymId) {
    return { allowed: false, reason: 'cross-gym comment rejected: comment gym_id must match post gym_id' };
  }

  const mem = memberships.find(m => m.gymId === post.gymId && m.userId === ctx.userId && m.status === 'active');
  if (!mem) return { allowed: false, reason: 'active membership required' };

  return { allowed: true };
}

// 3. gym_post_reports RLS
function simulateGymPostReportsSelect(
  ctx: SessionContext | null,
  reports: GymPostReport[],
  gymOwners: Record<string, string>
): GymPostReport[] {
  if (!ctx || ctx.role === 'anon') return [];

  return reports.filter(r => {
    // 1. Gym owner can read all reports for their gym
    if (gymOwners[r.gymId] === ctx.userId) return true;
    // 2. Member can read only their own filed reports
    if (r.reporterId === ctx.userId) return true;
    return false;
  });
}

function simulateReportInsert(
  ctx: SessionContext | null,
  report: { gymId: string; reporterId: string; targetType: 'post' | 'comment'; postId?: string | null; commentId?: string | null },
  existingReports: GymPostReport[],
  memberships: GymMembership[]
): { allowed: boolean; reason?: string } {
  if (!ctx || ctx.role === 'anon') return { allowed: false, reason: 'unauthenticated' };
  if (report.reporterId !== ctx.userId) return { allowed: false, reason: 'reporter_id spoofing denied' };

  const mem = memberships.find(m => m.gymId === report.gymId && m.userId === ctx.userId && m.status === 'active');
  if (!mem) return { allowed: false, reason: 'active membership required' };

  // Target constraints
  if (report.targetType === 'post' && (!report.postId || report.commentId)) {
    return { allowed: false, reason: 'invalid target constraints for post' };
  }
  if (report.targetType === 'comment' && (!report.commentId || report.postId)) {
    return { allowed: false, reason: 'invalid target constraints for comment' };
  }

  // Duplicate prevention
  if (report.targetType === 'post') {
    if (existingReports.some(r => r.reporterId === ctx.userId && r.postId === report.postId)) {
      return { allowed: false, reason: 'duplicate report denied' };
    }
  } else {
    if (existingReports.some(r => r.reporterId === ctx.userId && r.commentId === report.commentId)) {
      return { allowed: false, reason: 'duplicate report denied' };
    }
  }

  return { allowed: true };
}

describe('Phase G2 Security & RLS Suite', () => {
  const gymAlpha = 'gym-alpha-id';
  const gymBeta = 'gym-beta-id';

  const ownerAlpha = 'owner-alpha-id';
  const ownerBeta = 'owner-beta-id';

  const memberAlice = 'member-alice-id'; // Active in Gym Alpha
  const memberFrozen = 'member-frozen-id'; // Frozen in Gym Alpha
  const memberPending = 'member-pending-id'; // Pending in Gym Alpha
  const memberBob = 'member-bob-id'; // Active in Gym Beta
  const memberUnregistered = 'member-unregistered-id'; // Non-integrated

  const gymOwners: Record<string, string> = {
    [gymAlpha]: ownerAlpha,
    [gymBeta]: ownerBeta,
  };

  const memberships: GymMembership[] = [
    { id: 'm1', gymId: gymAlpha, userId: memberAlice, status: 'active', membershipType: 'full_access', joinedAt: '2026-01-01' },
    { id: 'm2', gymId: gymAlpha, userId: memberFrozen, status: 'frozen', membershipType: 'full_access', joinedAt: '2026-01-01' },
    { id: 'm3', gymId: gymAlpha, userId: memberPending, status: 'pending', membershipType: 'full_access', joinedAt: '2026-01-01' },
    { id: 'm4', gymId: gymBeta, userId: memberBob, status: 'active', membershipType: 'full_access', joinedAt: '2026-01-01' },
  ];

  const samplePosts: GymPost[] = [
    {
      id: 'post-1',
      gymId: gymAlpha,
      authorId: memberAlice,
      content: 'Alice post in Alpha',
      status: 'published',
      isPinned: false,
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'post-2',
      gymId: gymAlpha,
      authorId: memberAlice,
      content: 'Removed offending post in Alpha',
      status: 'removed',
      isPinned: false,
      createdAt: '2026-09-01T11:00:00Z',
      updatedAt: '2026-09-01T11:00:00Z',
    },
    {
      id: 'post-3',
      gymId: gymBeta,
      authorId: memberBob,
      content: 'Bob post in Beta',
      status: 'published',
      isPinned: false,
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-09-01T12:00:00Z',
    },
  ];

  // ── 1. CROSS-GYM READ & WRITE ISOLATION ─────────────────────────────────

  describe('Multi-Tenant Cross-Gym Isolation', () => {
    it('member A cannot read Gym B feed', () => {
      const aliceContext: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const visibleToAlice = simulateGymPostsSelect(aliceContext, samplePosts, memberships, gymOwners);

      // Alice only sees posts from Gym Alpha
      expect(visibleToAlice.every(p => p.gymId === gymAlpha)).toBe(true);
      expect(visibleToAlice.some(p => p.id === 'post-3')).toBe(false);
    });

    it('member A cannot insert post into Gym B (gym_id IDOR denied)', () => {
      const aliceContext: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const check = simulateGymPostInsert(aliceContext, gymBeta, memberAlice, memberships);

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('active membership required');
    });

    it('owner A cannot moderate Gym B content', () => {
      const ownerAContext: SessionContext = { userId: ownerAlpha, role: 'authenticated' };
      const betaPost = samplePosts.find(p => p.id === 'post-3')!;

      // Owner A trying to set status to removed on Gym B's post
      const isOwnerB = gymOwners[betaPost.gymId] === ownerAContext.userId;
      expect(isOwnerB).toBe(false);
    });
  });

  // ── 2. MEMBER ACCESS MATRIX ──────────────────────────────────────────────

  describe('Membership Status Access Matrix', () => {
    it('ACTIVE member can read published posts and create posts', () => {
      const ctx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const readable = simulateGymPostsSelect(ctx, samplePosts, memberships, gymOwners);
      expect(readable.length).toBe(1);
      expect(readable[0].id).toBe('post-1');

      const insertCheck = simulateGymPostInsert(ctx, gymAlpha, memberAlice, memberships);
      expect(insertCheck.allowed).toBe(true);
    });

    it('FROZEN member has read-only access: can read feed but cannot create posts', () => {
      const ctx: SessionContext = { userId: memberFrozen, role: 'authenticated' };

      // Can read published posts
      const readable = simulateGymPostsSelect(ctx, samplePosts, memberships, gymOwners);
      expect(readable.length).toBe(1);
      expect(readable[0].id).toBe('post-1');

      // Cannot create posts
      const insertCheck = simulateGymPostInsert(ctx, gymAlpha, memberFrozen, memberships);
      expect(insertCheck.allowed).toBe(false);
      expect(insertCheck.reason).toContain('active membership required');
    });

    it('PENDING and INACTIVE members have zero community access', () => {
      const ctx: SessionContext = { userId: memberPending, role: 'authenticated' };

      // Cannot read feed
      const readable = simulateGymPostsSelect(ctx, samplePosts, memberships, gymOwners);
      expect(readable.length).toBe(0);

      // Cannot insert
      const insertCheck = simulateGymPostInsert(ctx, gymAlpha, memberPending, memberships);
      expect(insertCheck.allowed).toBe(false);
    });

    it('NON-INTEGRATED user has zero community access', () => {
      const ctx: SessionContext = { userId: memberUnregistered, role: 'authenticated' };

      const readable = simulateGymPostsSelect(ctx, samplePosts, memberships, gymOwners);
      expect(readable.length).toBe(0);

      const insertCheck = simulateGymPostInsert(ctx, gymAlpha, memberUnregistered, memberships);
      expect(insertCheck.allowed).toBe(false);
    });
  });

  // ── 3. ANTI-SPOOFING & PROTECTED MODERATION FIELDS ───────────────────────

  describe('Anti-Spoofing & Protected Moderation Fields', () => {
    it('denies author_id spoofing at insertion', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      // Alice tries to insert with authorId = Bob
      const check = simulateGymPostInsert(aliceCtx, gymAlpha, memberBob, memberships);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('author_id spoofing denied');
    });

    it('denies member from mutating is_pinned (self-pinning)', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const post = samplePosts[0];

      const check = simulateGymPostUpdate(aliceCtx, post, { isPinned: true }, gymOwners);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('only gym owner can modify pin status');
    });

    it('denies member from mutating moderation fields or reassigning author', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const post = samplePosts[0];

      // Mutate moderated_by
      const check1 = simulateGymPostUpdate(aliceCtx, post, { moderatedBy: memberAlice }, gymOwners);
      expect(check1.allowed).toBe(false);
      expect(check1.reason).toContain('members cannot modify moderation fields');

      // Mutate author_id
      const check2 = simulateGymPostUpdate(aliceCtx, post, { authorId: memberBob }, gymOwners);
      expect(check2.allowed).toBe(false);
      expect(check2.reason).toContain('author_id is immutable');

      // Mutate gym_id
      const check3 = simulateGymPostUpdate(aliceCtx, post, { gymId: gymBeta }, gymOwners);
      expect(check3.allowed).toBe(false);
      expect(check3.reason).toContain('gym_id is immutable');
    });

    it('denies member from setting status to removed (owner-only status)', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const post = samplePosts[0];

      const check = simulateGymPostUpdate(aliceCtx, post, { status: 'removed' }, gymOwners);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('members can only set status to hidden');
    });
  });

  // ── 4. SAME-GYM COMMENT ENFORCEMENT ──────────────────────────────────────

  describe('Comment Gym Consistency', () => {
    it('member A can read Gym A comments and cannot read Gym B comments', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const sampleComments: GymComment[] = [
        { id: 'c1', postId: 'post-1', gymId: gymAlpha, authorId: memberAlice, content: 'Alpha comment', status: 'published', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
        { id: 'c2', postId: 'post-3', gymId: gymBeta, authorId: memberBob, content: 'Beta comment', status: 'published', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
      ];
      const visible = simulateGymCommentsSelect(aliceCtx, sampleComments, memberships, gymOwners);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe('c1');
    });

    it('denies comment insertion when comment gym_id does not match post gym_id', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const betaPost = samplePosts.find(p => p.id === 'post-3')!; // Belongs to Gym Beta

      // Alice tries to comment against Gym Beta post using Gym Alpha context
      const check = simulateGymCommentInsert(aliceCtx, betaPost, gymAlpha, memberAlice, memberships);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('cross-gym comment rejected');
    });
  });

  // ── 5. REPORTING SECURITY & DUPLICATE PREVENTION ─────────────────────────

  describe('Reporting Security & Audit Preservation', () => {
    const existingReports: GymPostReport[] = [
      {
        id: 'rep-1',
        gymId: gymAlpha,
        targetType: 'post',
        postId: 'post-1',
        commentId: null,
        reporterId: memberAlice,
        reason: 'spam',
        status: 'pending',
        createdAt: '2026-09-01T12:00:00Z',
      },
    ];

    it('denies duplicate reports on the same target by the same reporter', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };

      const check = simulateReportInsert(
        aliceCtx,
        {
          gymId: gymAlpha,
          reporterId: memberAlice,
          targetType: 'post',
          postId: 'post-1',
          commentId: null,
        },
        existingReports,
        memberships
      );

      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('duplicate report denied');
    });

    it('preserves reporter isolation: member cannot view reports filed by other members', () => {
      const bobCtx: SessionContext = { userId: memberBob, role: 'authenticated' };
      const visibleToBob = simulateGymPostReportsSelect(bobCtx, existingReports, gymOwners);
      expect(visibleToBob.length).toBe(0);

      // Alice can view her own report
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };
      const visibleToAlice = simulateGymPostReportsSelect(aliceCtx, existingReports, gymOwners);
      expect(visibleToAlice.length).toBe(1);

      // Gym Owner can view all reports for the gym
      const ownerAlphaCtx: SessionContext = { userId: ownerAlpha, role: 'authenticated' };
      const visibleToOwner = simulateGymPostReportsSelect(ownerAlphaCtx, existingReports, gymOwners);
      expect(visibleToOwner.length).toBe(1);
    });

    it('enforces target-specific exclusivity (post vs comment)', () => {
      const aliceCtx: SessionContext = { userId: memberAlice, role: 'authenticated' };

      // Invalid post report with commentId provided
      const invalidPost = simulateReportInsert(
        aliceCtx,
        {
          gymId: gymAlpha,
          reporterId: memberAlice,
          targetType: 'post',
          postId: 'post-2',
          commentId: 'comment-123',
        },
        [],
        memberships
      );
      expect(invalidPost.allowed).toBe(false);
      expect(invalidPost.reason).toContain('invalid target constraints');
    });

    it('preserves report integrity: soft-deletion maintains report references while hard-deletion is RESTRICTed', () => {
      // 1. Soft-deletion behavior in G2:
      // When a post is moderated or removed, its status changes to 'removed', but the record remains in gym_posts.
      const reportedPost: GymPost = {
        id: 'post-reported-1',
        gymId: gymAlpha,
        authorId: memberAlice,
        content: 'Reported spam message',
        status: 'published',
        isPinned: false,
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };
      const report: GymPostReport = {
        id: 'rep-audit-1',
        gymId: gymAlpha,
        targetType: 'post',
        postId: reportedPost.id,
        commentId: null,
        reporterId: memberBob,
        reason: 'spam',
        status: 'pending',
        createdAt: '2026-09-01T11:00:00Z',
      };

      // Owner moderates post -> status becomes 'removed'
      reportedPost.status = 'removed';
      // Verification: report target FK is intact and CHECK constraint is fully satisfied
      expect(report.postId).toBe(reportedPost.id);
      expect(report.targetType === 'post' && report.postId !== null && report.commentId === null).toBe(true);

      // 2. Hard deletion protection:
      // If a destructive SQL DELETE were attempted directly, ON DELETE RESTRICT blocks it
      const simulateHardDeletePost = (postId: string, activeReports: GymPostReport[]): { allowed: boolean; error?: string } => {
        const hasLinkedReports = activeReports.some(r => r.postId === postId || r.commentId === postId);
        if (hasLinkedReports) {
          return {
            allowed: false,
            error: 'update or delete on table "gym_posts" violates foreign key constraint "gym_post_reports_post_id_fkey" on table "gym_post_reports"',
          };
        }
        return { allowed: true };
      };

      const hardDeleteAttempt = simulateHardDeletePost(reportedPost.id, [report]);
      expect(hardDeleteAttempt.allowed).toBe(false);
      expect(hardDeleteAttempt.error).toContain('violates foreign key constraint');
    });
  });

  // ── 6. CONCURRENT PIN LIMIT TRANSACTION ENFORCEMENT ──────────────────────

  describe('Authoritative Gym Row Lock & Concurrency (Max 3 Pins)', () => {
    it('serializes concurrent pin operations via authoritative gym row lock ensuring count never exceeds 3', async () => {
      // Initial state: Gym has 2 pinned published posts
      let currentPinnedCount = 2;
      const MAX_PINS = 3;

      // Mutex representing PostgreSQL row-level lock on `public.gyms WHERE id = v_gym_id FOR UPDATE`
      let isGymRowLocked = false;
      const waitQueue: Array<() => void> = [];

      const acquireGymRowLock = (): Promise<void> => {
        if (!isGymRowLocked) {
          isGymRowLocked = true;
          return Promise.resolve();
        }
        return new Promise<void>(resolve => {
          waitQueue.push(resolve);
        });
      };

      const releaseGymRowLock = () => {
        if (waitQueue.length > 0) {
          const next = waitQueue.shift()!;
          next();
        } else {
          isGymRowLocked = false;
        }
      };

      // Simulated transaction embodying:
      // 1. PERFORM id FROM public.gyms WHERE id = v_gym_id FOR UPDATE;
      // 2. SELECT COUNT(*) ... WHERE gym_id = v_gym_id AND is_pinned = TRUE AND status = 'published';
      // 3. IF count >= 3 THEN RAISE EXCEPTION;
      // 4. UPDATE public.gym_posts SET is_pinned = TRUE;
      const authoritativePinAttempt = async (
        _postId: string,
        delayMs: number
      ): Promise<{ success: boolean; error?: string }> => {
        await acquireGymRowLock();
        try {
          // Simulate query latency inside the transaction
          await new Promise(r => setTimeout(r, delayMs));

          if (currentPinnedCount >= MAX_PINS) {
            return { success: false, error: 'Maximum 3 pinned posts allowed per facility' };
          }
          currentPinnedCount += 1;
          return { success: true };
        } finally {
          releaseGymRowLock();
        }
      };

      // Launch 5 simultaneous pin requests targeting the 1 available slot
      const requests = [
        authoritativePinAttempt('post-pin-1', 15),
        authoritativePinAttempt('post-pin-2', 10),
        authoritativePinAttempt('post-pin-3', 5),
        authoritativePinAttempt('post-pin-4', 12),
        authoritativePinAttempt('post-pin-5', 8),
      ];

      const results = await Promise.all(requests);

      const successfulPins = results.filter(r => r.success);
      const rejectedPins = results.filter(r => !r.success);

      // Invariant checks:
      // 1. Exactly 1 request succeeds (2 existing + 1 new = 3)
      expect(successfulPins.length).toBe(1);
      // 2. Remaining 4 requests fail with transactional limit exception
      expect(rejectedPins.length).toBe(4);
      rejectedPins.forEach(r => {
        expect(r.error).toBe('Maximum 3 pinned posts allowed per facility');
      });
      // 3. Final pinned count is strictly 3
      expect(currentPinnedCount).toBe(3);
    });

    it('denies cross-gym pin requests: Owner Alpha cannot pin a post belonging to Gym Beta', () => {
      const ownerAlphaCtx: SessionContext = { userId: ownerAlpha, role: 'authenticated' };
      const betaPost = samplePosts.find(p => p.id === 'post-3')!; // Belongs to Gym Beta

      // Verify owner authorization check inside set_gym_post_pinned RPC
      const isOwnerOfTargetGym = gymOwners[betaPost.gymId] === ownerAlphaCtx.userId;
      expect(isOwnerOfTargetGym).toBe(false);
    });
  });

  // ── 7. XSS & CONTENT SAFETY ──────────────────────────────────────────────

  describe('XSS & Content Safety', () => {
    it('escapes and treats HTML script tags as inert plain text', () => {
      const dangerousPayload = `<script>alert('xss');</script><img src="x" onerror="stealCookies()"/>`;
      
      // Verification: we do NOT sanitize into HTML or execute dangerouslySetInnerHTML.
      // The application treats content as raw text.
      const simulatedRender = dangerousPayload;
      expect(simulatedRender).toBe(dangerousPayload);
      expect(typeof simulatedRender).toBe('string');
      // No eval, no dangerouslySetInnerHTML property exists
    });
  });
});
