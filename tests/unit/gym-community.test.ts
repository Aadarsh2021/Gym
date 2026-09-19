import { describe, it, expect, beforeEach } from 'vitest';
import { gymRepository } from '@/repositories/gym.repository';
import { platform } from '@/platform';

describe('Phase G2 Unit Tests: Gym Community & Moderation', () => {
  const gymA = 'mock-gym-alpha';
  const gymB = 'mock-gym-beta';

  const memberAlice = 'mock-member-alice';
  const memberBob = 'mock-member-bob';
  const ownerGymA = 'mock-owner-gym-a';

  beforeEach(() => {
    platform.storage.removeItem(`gym_posts_${gymA}`);
    platform.storage.removeItem(`gym_posts_${gymB}`);
    platform.storage.removeItem(`gym_reports_${gymA}`);
    platform.storage.removeItem(`gym_reports_${gymB}`);
  });

  // ── 1. POSTS ─────────────────────────────────────────────────────────────

  describe('Post Management', () => {
    it('creates a published post with valid content', async () => {
      const res = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Excited for leg day today at the gym!',
        authorName: 'Alice Walker',
      });

      expect(res.success).toBe(true);
      expect(res.post).toBeDefined();
      expect(res.post?.content).toBe('Excited for leg day today at the gym!');
      expect(res.post?.status).toBe('published');
      expect(res.post?.isPinned).toBe(false);
      expect(res.post?.authorId).toBe(memberAlice);

      const feed = await gymRepository.fetchGymPosts(gymA);
      expect(feed.posts.length).toBe(1);
      expect(feed.posts[0].id).toBe(res.post?.id);
    });

    it('rejects empty post content and enforces 2000 characters limit', async () => {
      const emptyRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: '   ',
      });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toContain('Post content cannot be empty');

      const longContent = 'A'.repeat(2001);
      const longRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: longContent,
      });
      expect(longRes.success).toBe(false);
      expect(longRes.error).toContain('limit');
    });

    it('allows author to edit their own post', async () => {
      const createRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Initial text',
      });
      const postId = createRes.post!.id;

      const editRes = await gymRepository.updateGymPost({
        id: postId,
        authorId: memberAlice,
        content: 'Edited content by Alice',
        gymId: gymA,
      });

      expect(editRes.success).toBe(true);
      expect(editRes.post?.content).toBe('Edited content by Alice');

      const feed = await gymRepository.fetchGymPosts(gymA);
      expect(feed.posts[0].content).toBe('Edited content by Alice');
    });

    it('denies a member from editing another member post', async () => {
      const createRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Alice private thoughts',
      });
      const postId = createRes.post!.id;

      const editRes = await gymRepository.updateGymPost({
        id: postId,
        authorId: memberBob, // Bob tries to edit Alice's post
        content: 'Hacked by Bob',
        gymId: gymA,
      });

      expect(editRes.success).toBe(false);
      expect(editRes.error).toContain('Unauthorized');
    });

    it('allows author to soft-delete their own post (status becomes hidden)', async () => {
      const createRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Post to be removed',
      });
      const postId = createRes.post!.id;

      const delRes = await gymRepository.deleteGymPost({
        id: postId,
        authorId: memberAlice,
        gymId: gymA,
      });
      expect(delRes.success).toBe(true);

      // Normal member feed only returns published posts
      const memberFeed = await gymRepository.fetchGymPosts(gymA);
      expect(memberFeed.posts.find(p => p.id === postId)).toBeUndefined();

      // Owner/audit query with includeAllStatuses sees the hidden record
      const ownerFeed = await gymRepository.fetchGymPosts(gymA, { includeAllStatuses: true });
      const hiddenPost = ownerFeed.posts.find(p => p.id === postId);
      expect(hiddenPost).toBeDefined();
      expect(hiddenPost?.status).toBe('hidden');
    });

    it('denies a member from deleting another member post', async () => {
      const createRes = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Alice post',
      });
      const postId = createRes.post!.id;

      const delRes = await gymRepository.deleteGymPost({
        id: postId,
        authorId: memberBob, // Bob tries to delete
        gymId: gymA,
      });
      expect(delRes.success).toBe(false);
      expect(delRes.error).toContain('Unauthorized');
    });

    it('supports pagination and preserves pinned posts first', async () => {
      // Create 5 normal posts
      for (let i = 1; i <= 5; i++) {
        await gymRepository.createGymPost({
          gymId: gymA,
          authorId: memberAlice,
          content: `Post number ${i}`,
        });
      }

      // Create a pinned post (older timestamp simulated)
      const pinPost = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Important Gym Safety Rules',
      });
      await gymRepository.pinGymPost(pinPost.post!.id, true, gymA);

      // Fetch page size 3
      const page1 = await gymRepository.fetchGymPosts(gymA, { limit: 3 });
      expect(page1.posts.length).toBe(3);
      // Pinned post must come first
      expect(page1.posts[0].id).toBe(pinPost.post!.id);
      expect(page1.posts[0].isPinned).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Fetch next page using cursor
      const page2 = await gymRepository.fetchGymPosts(gymA, { limit: 3, cursor: page1.nextCursor });
      expect(page2.posts.length).toBe(3);
      // No overlap
      const p1Ids = new Set(page1.posts.map(p => p.id));
      for (const p of page2.posts) {
        expect(p1Ids.has(p.id)).toBe(false);
      }
    });
  });

  // ── 2. COMMENTS ──────────────────────────────────────────────────────────

  describe('Comment Management', () => {
    let testPostId: string;

    beforeEach(async () => {
      const res = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'What time is the evening spin class?',
      });
      testPostId = res.post!.id;
      platform.storage.removeItem(`gym_comments_${testPostId}`);
    });

    it('creates and lists comments on a post', async () => {
      const cRes = await gymRepository.createGymComment({
        postId: testPostId,
        gymId: gymA,
        authorId: memberBob,
        content: 'Starts at 6:30 PM today!',
        authorName: 'Bob',
      });

      expect(cRes.success).toBe(true);
      expect(cRes.comment?.content).toBe('Starts at 6:30 PM today!');
      expect(cRes.comment?.status).toBe('published');

      const comments = await gymRepository.fetchGymComments(testPostId);
      expect(comments.length).toBe(1);
      expect(comments[0].id).toBe(cRes.comment?.id);
    });

    it('allows comment author to edit own comment', async () => {
      const cRes = await gymRepository.createGymComment({
        postId: testPostId,
        gymId: gymA,
        authorId: memberBob,
        content: 'Original comment',
      });
      const commentId = cRes.comment!.id;

      const editRes = await gymRepository.updateGymComment({
        id: commentId,
        authorId: memberBob,
        content: 'Corrected comment: 7:00 PM',
        postId: testPostId,
      });
      expect(editRes.success).toBe(true);
      expect(editRes.comment?.content).toBe('Corrected comment: 7:00 PM');
    });

    it('denies a member from editing another member comment', async () => {
      const cRes = await gymRepository.createGymComment({
        postId: testPostId,
        gymId: gymA,
        authorId: memberBob,
        content: 'Bob comment',
      });
      const commentId = cRes.comment!.id;

      const editRes = await gymRepository.updateGymComment({
        id: commentId,
        authorId: memberAlice, // Alice tries to edit Bob's comment
        content: 'Edited by Alice',
        postId: testPostId,
      });
      expect(editRes.success).toBe(false);
      expect(editRes.error).toContain('Unauthorized');
    });

    it('allows comment author to soft-delete own comment', async () => {
      const cRes = await gymRepository.createGymComment({
        postId: testPostId,
        gymId: gymA,
        authorId: memberBob,
        content: 'Comment to remove',
      });
      const commentId = cRes.comment!.id;

      const delRes = await gymRepository.deleteGymComment({
        id: commentId,
        authorId: memberBob,
        postId: testPostId,
      });
      expect(delRes.success).toBe(true);

      const comments = await gymRepository.fetchGymComments(testPostId);
      expect(comments.find(c => c.id === commentId)).toBeUndefined();
    });
  });

  // ── 3. REPORTS ───────────────────────────────────────────────────────────

  describe('Community Reporting', () => {
    let testPostId: string;

    beforeEach(async () => {
      const res = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberBob,
        content: 'Suspicious commercial advertisement message',
      });
      testPostId = res.post!.id;
    });

    it('submits a report for a post', async () => {
      const res = await gymRepository.reportGymContent({
        gymId: gymA,
        targetType: 'post',
        postId: testPostId,
        reporterId: memberAlice,
        reason: 'spam',
        details: 'Self-promotion link without authorization.',
      });

      expect(res.success).toBe(true);
      expect(res.report?.status).toBe('pending');
      expect(res.report?.reason).toBe('spam');
      expect(res.report?.postId).toBe(testPostId);

      const reports = await gymRepository.fetchGymReports(gymA);
      expect(reports.length).toBe(1);
      expect(reports[0].id).toBe(res.report?.id);
    });

    it('prevents duplicate reports by the same user on the same post', async () => {
      const first = await gymRepository.reportGymContent({
        gymId: gymA,
        targetType: 'post',
        postId: testPostId,
        reporterId: memberAlice,
        reason: 'spam',
      });
      expect(first.success).toBe(true);

      const second = await gymRepository.reportGymContent({
        gymId: gymA,
        targetType: 'post',
        postId: testPostId,
        reporterId: memberAlice,
        reason: 'harassment',
      });
      expect(second.success).toBe(false);
      expect(second.error).toContain('already reported');
    });

    it('allows gym owner to resolve report with action taken', async () => {
      const rep = await gymRepository.reportGymContent({
        gymId: gymA,
        targetType: 'post',
        postId: testPostId,
        reporterId: memberAlice,
        reason: 'inappropriate',
      });
      const reportId = rep.report!.id;

      const resolveRes = await gymRepository.resolveGymReport(
        reportId,
        'action_taken',
        'Removed offending post per community guidelines.',
        gymA
      );
      expect(resolveRes.success).toBe(true);

      const reports = await gymRepository.fetchGymReports(gymA);
      const updated = reports.find(r => r.id === reportId);
      expect(updated?.status).toBe('action_taken');
      expect(updated?.resolutionNotes).toContain('offending post');
    });
  });

  // ── 4. OWNER MODERATION & PIN LIMITS ─────────────────────────────────────

  describe('Owner Moderation & Pin Limits', () => {
    it('enforces maximum 3 pinned posts per gym', async () => {
      const postIds: string[] = [];
      for (let i = 1; i <= 4; i++) {
        const res = await gymRepository.createGymPost({
          gymId: gymA,
          authorId: ownerGymA,
          content: `Notice ${i}`,
        });
        postIds.push(res.post!.id);
      }

      // Pin post 1, 2, 3 -> All succeed
      const pin1 = await gymRepository.pinGymPost(postIds[0], true, gymA);
      const pin2 = await gymRepository.pinGymPost(postIds[1], true, gymA);
      const pin3 = await gymRepository.pinGymPost(postIds[2], true, gymA);

      expect(pin1.success).toBe(true);
      expect(pin2.success).toBe(true);
      expect(pin3.success).toBe(true);

      // Attempting to pin 4th post -> MUST fail with max 3 limit error
      const pin4 = await gymRepository.pinGymPost(postIds[3], true, gymA);
      expect(pin4.success).toBe(false);
      expect(pin4.error).toContain('Maximum of 3 pinned posts allowed');

      // Unpin post 1
      const unpin1 = await gymRepository.pinGymPost(postIds[0], false, gymA);
      expect(unpin1.success).toBe(true);

      // Now post 4 can be pinned
      const pin4Retry = await gymRepository.pinGymPost(postIds[3], true, gymA);
      expect(pin4Retry.success).toBe(true);
    });

    it('allows owner to moderate and remove post with reason', async () => {
      const res = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberBob,
        content: 'Violating post',
      });
      const postId = res.post!.id;

      const modRes = await gymRepository.moderateGymPost(
        postId,
        'removed',
        'Violates gym safety policy',
        gymA
      );
      expect(modRes.success).toBe(true);

      // Member feed should not include removed post
      const memberFeed = await gymRepository.fetchGymPosts(gymA);
      expect(memberFeed.posts.find(p => p.id === postId)).toBeUndefined();

      // Owner feed shows post as removed with moderation reason
      const ownerFeed = await gymRepository.fetchGymPosts(gymA, { includeAllStatuses: true });
      const found = ownerFeed.posts.find(p => p.id === postId);
      expect(found?.status).toBe('removed');
      expect(found?.moderationReason).toBe('Violates gym safety policy');
    });

    it('accurately computes community stats', async () => {
      // 1 active published post
      const p1 = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberAlice,
        content: 'Active post 1',
      });
      // 1 pinned published post
      const p2 = await gymRepository.createGymPost({
        gymId: gymA,
        authorId: memberBob,
        content: 'Pinned post 2',
      });
      await gymRepository.pinGymPost(p2.post!.id, true, gymA);

      // 1 pending report
      await gymRepository.reportGymContent({
        gymId: gymA,
        targetType: 'post',
        postId: p1.post!.id,
        reporterId: memberBob,
        reason: 'spam',
      });

      const stats = await gymRepository.fetchGymCommunityStats(gymA);
      expect(stats.activePostsCount).toBe(2);
      expect(stats.pinnedPostsCount).toBe(1);
      expect(stats.pendingReportsCount).toBe(1);
    });
  });
});
