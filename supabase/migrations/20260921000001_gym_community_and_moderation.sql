-- ==============================================================================
-- FITBOOST MIGRATION: PHASE G2 — GYM COMMUNITY & MODERATION
-- 1. Creates gym_posts with soft deletion, status, and pinning support
-- 2. Creates gym_comments with same-gym integrity and moderation fields
-- 3. Creates gym_post_reports with duplicate prevention and audit trail retention
-- 4. Enables RLS on all 3 tables with active/frozen member and owner isolation
-- 5. Enforces max 3 pinned posts transactionally via set_gym_post_pinned RPC
-- 6. Implements authoritative owner moderation RPCs (moderate post, comment, resolve report)
-- ==============================================================================

-- 1. GYM POSTS TABLE
CREATE TABLE IF NOT EXISTS public.gym_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 2000),
    status TEXT DEFAULT 'published' NOT NULL CHECK (status IN ('published', 'hidden', 'removed')),
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    pinned_at TIMESTAMPTZ,
    pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,
    moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Compound Indexes for Feed and Owner Management
CREATE INDEX IF NOT EXISTS idx_gym_posts_feed
ON public.gym_posts (gym_id, is_pinned DESC, created_at DESC)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_gym_posts_owner_mod
ON public.gym_posts (gym_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gym_posts_author
ON public.gym_posts (author_id, created_at DESC);

ALTER TABLE public.gym_posts ENABLE ROW LEVEL SECURITY;


-- 2. GYM COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.gym_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.gym_posts(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 1000),
    status TEXT DEFAULT 'published' NOT NULL CHECK (status IN ('published', 'hidden', 'removed')),
    moderated_at TIMESTAMPTZ,
    moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    moderation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gym_comments_post
ON public.gym_comments (post_id, created_at ASC)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_gym_comments_gym_owner
ON public.gym_comments (gym_id, status, created_at DESC);

ALTER TABLE public.gym_comments ENABLE ROW LEVEL SECURITY;


-- 3. GYM POST REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.gym_post_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    post_id UUID REFERENCES public.gym_posts(id) ON DELETE RESTRICT,
    comment_id UUID REFERENCES public.gym_comments(id) ON DELETE RESTRICT,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'hate_speech', 'other')),
    details TEXT CHECK (details IS NULL OR char_length(details) <= 500),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_report_target CHECK (
        (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL) OR
        (target_type = 'comment' AND comment_id IS NOT NULL AND post_id IS NULL)
    ),
    -- Anti-spam: A member cannot submit duplicate reports on the same target
    CONSTRAINT uq_report_member_post UNIQUE (reporter_id, post_id),
    CONSTRAINT uq_report_member_comment UNIQUE (reporter_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_post_reports_queue
ON public.gym_post_reports (gym_id, status, created_at DESC);

ALTER TABLE public.gym_post_reports ENABLE ROW LEVEL SECURITY;


-- 4. ROW LEVEL SECURITY POLICIES

-- 4A. GYM POSTS POLICIES
DROP POLICY IF EXISTS "Members view published posts for own gym" ON public.gym_posts;
CREATE POLICY "Members view published posts for own gym"
ON public.gym_posts FOR SELECT
TO authenticated
USING (
    (status = 'published' AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_posts.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status IN ('active', 'frozen')
    ))
    OR (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_posts.gym_id
          AND g.owner_id = auth.uid()
    ))
);

DROP POLICY IF EXISTS "Active members insert posts for own gym" ON public.gym_posts;
CREATE POLICY "Active members insert posts for own gym"
ON public.gym_posts FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id
    AND status = 'published'
    AND is_pinned = FALSE
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_posts.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Authors update own post content or soft delete" ON public.gym_posts;
CREATE POLICY "Authors update own post content or soft delete"
ON public.gym_posts FOR UPDATE
TO authenticated
USING (
    (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_posts.gym_id
          AND g.owner_id = auth.uid()
    ))
)
WITH CHECK (
    (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_posts.gym_id
          AND g.owner_id = auth.uid()
    ))
);

-- Deny direct client physical DELETE (must soft delete via status = 'removed')
REVOKE DELETE ON public.gym_posts FROM authenticated, anon;


-- 4B. GYM COMMENTS POLICIES
DROP POLICY IF EXISTS "Members view published comments for own gym" ON public.gym_comments;
CREATE POLICY "Members view published comments for own gym"
ON public.gym_comments FOR SELECT
TO authenticated
USING (
    (status = 'published' AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_comments.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status IN ('active', 'frozen')
    ))
    OR (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_comments.gym_id
          AND g.owner_id = auth.uid()
    ))
);

DROP POLICY IF EXISTS "Active members insert comments for own gym" ON public.gym_comments;
CREATE POLICY "Active members insert comments for own gym"
ON public.gym_comments FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id
    AND status = 'published'
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_comments.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    )
    AND EXISTS (
        SELECT 1 FROM public.gym_posts gp
        WHERE gp.id = gym_comments.post_id
          AND gp.gym_id = gym_comments.gym_id
          AND gp.status = 'published'
    )
);

DROP POLICY IF EXISTS "Authors update own comment content or soft delete" ON public.gym_comments;
CREATE POLICY "Authors update own comment content or soft delete"
ON public.gym_comments FOR UPDATE
TO authenticated
USING (
    (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_comments.gym_id
          AND g.owner_id = auth.uid()
    ))
)
WITH CHECK (
    (author_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_comments.gym_id
          AND g.owner_id = auth.uid()
    ))
);

REVOKE DELETE ON public.gym_comments FROM authenticated, anon;


-- 4C. GYM POST REPORTS POLICIES
DROP POLICY IF EXISTS "Reporters and Owners view reports" ON public.gym_post_reports;
CREATE POLICY "Reporters and Owners view reports"
ON public.gym_post_reports FOR SELECT
TO authenticated
USING (
    (reporter_id = auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_post_reports.gym_id
          AND g.owner_id = auth.uid()
    ))
);

DROP POLICY IF EXISTS "Active members submit reports for own gym" ON public.gym_post_reports;
CREATE POLICY "Active members submit reports for own gym"
ON public.gym_post_reports FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = reporter_id
    AND status = 'pending'
    AND EXISTS (
        SELECT 1 FROM public.gym_memberships gm
        WHERE gm.gym_id = gym_post_reports.gym_id
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
    )
);

-- Direct client updates/deletes to reports are revoked for members
-- Report status resolution executes strictly through resolve_gym_post_report RPC
REVOKE UPDATE, DELETE ON public.gym_post_reports FROM authenticated, anon;


-- 5. TRIGGER FOR NON-OWNER MUTATION INTEGRITY
CREATE OR REPLACE FUNCTION public.protect_gym_community_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_owner BOOLEAN := FALSE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Check if caller owns the facility
    SELECT EXISTS (
        SELECT 1 FROM public.gyms g WHERE g.id = OLD.gym_id AND g.owner_id = v_caller_id
    ) INTO v_is_owner;

    -- If owner is making the change, allow all valid owner moderation changes
    IF v_is_owner THEN
        RETURN NEW;
    END IF;

    -- Caller is a regular member / author:
    -- 1. Cannot change author_id or gym_id
    IF NEW.author_id <> OLD.author_id THEN
        RAISE EXCEPTION 'Cannot reassign post author' USING ERRCODE = '40301';
    END IF;
    IF NEW.gym_id <> OLD.gym_id THEN
        RAISE EXCEPTION 'Cannot reassign post gym' USING ERRCODE = '40302';
    END IF;

    -- 2. Cannot alter moderation fields or pinning
    IF NEW.is_pinned <> OLD.is_pinned OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by THEN
        RAISE EXCEPTION 'Members cannot modify pin status' USING ERRCODE = '40303';
    END IF;
    IF NEW.moderated_by IS DISTINCT FROM OLD.moderated_by OR
       NEW.moderated_at IS DISTINCT FROM OLD.moderated_at OR
       NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason THEN
        RAISE EXCEPTION 'Members cannot modify moderation audit fields' USING ERRCODE = '40304';
    END IF;

    -- 3. Cannot restore a removed or hidden post; can only transition from published -> removed (soft delete)
    IF OLD.status = 'removed' AND NEW.status <> 'removed' THEN
        RAISE EXCEPTION 'Cannot restore removed post' USING ERRCODE = '40305';
    END IF;
    IF NEW.status NOT IN ('published', 'removed') THEN
        RAISE EXCEPTION 'Invalid status transition for member' USING ERRCODE = '40306';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_gym_posts_mutations ON public.gym_posts;
CREATE TRIGGER trg_protect_gym_posts_mutations
BEFORE UPDATE ON public.gym_posts
FOR EACH ROW
EXECUTE FUNCTION public.protect_gym_community_mutations();


-- 6. AUTHORITATIVE OWNER MODERATION RPCs (SECURITY DEFINER)

-- 6A. PIN / UNPIN POST (TRANSACTIONALLY ENFORCING MAXIMUM 3 PINNED POSTS)
CREATE OR REPLACE FUNCTION public.set_gym_post_pinned(
    p_post_id UUID,
    p_is_pinned BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_post RECORD;
    v_gym_id UUID;
    v_pinned_count INT := 0;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 1. Fetch post and resolve gym_id
    SELECT id, gym_id, status, is_pinned INTO v_post
    FROM public.gym_posts
    WHERE id = p_post_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post not found' USING ERRCODE = '40400';
    END IF;

    v_gym_id := v_post.gym_id;

    -- 2. Lock the authoritative gym row: serializes all pin/unpin operations for this facility
    PERFORM id
    FROM public.gyms
    WHERE id = v_gym_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Facility not found' USING ERRCODE = '40400';
    END IF;

    -- 3. Verify owner authorization before mutation
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g WHERE g.id = v_gym_id AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the facility owner' USING ERRCODE = '40300';
    END IF;

    -- 4. If pinning:
    IF p_is_pinned = TRUE THEN
        IF v_post.status <> 'published' THEN
            RAISE EXCEPTION 'Only published posts can be pinned' USING ERRCODE = '40003';
        END IF;

        -- Count current published pinned posts (excluding this post if already pinned)
        SELECT COUNT(*) INTO v_pinned_count
        FROM public.gym_posts
        WHERE gym_id = v_gym_id
          AND is_pinned = TRUE
          AND status = 'published'
          AND id <> p_post_id;

        IF v_pinned_count >= 3 THEN
            RAISE EXCEPTION 'Maximum 3 pinned posts allowed per facility' USING ERRCODE = '40005';
        END IF;

        UPDATE public.gym_posts
        SET is_pinned = TRUE,
            pinned_at = NOW(),
            pinned_by = v_caller_id,
            updated_at = NOW()
        WHERE id = p_post_id;
    ELSE
        -- 5. If unpinning:
        UPDATE public.gym_posts
        SET is_pinned = FALSE,
            pinned_at = NULL,
            pinned_by = NULL,
            updated_at = NOW()
        WHERE id = p_post_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'post_id', p_post_id,
        'is_pinned', p_is_pinned
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_gym_post_pinned(UUID, BOOLEAN) TO authenticated;


-- 6B. MODERATE / REMOVE POST
CREATE OR REPLACE FUNCTION public.moderate_gym_post(
    p_post_id UUID,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_post RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    IF p_status NOT IN ('published', 'hidden', 'removed') THEN
        RAISE EXCEPTION 'Invalid status for post moderation' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO v_post
    FROM public.gym_posts
    WHERE id = p_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post not found' USING ERRCODE = '40400';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g WHERE g.id = v_post.gym_id AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the facility owner' USING ERRCODE = '40300';
    END IF;

    UPDATE public.gym_posts
    SET status = p_status,
        is_pinned = CASE WHEN p_status <> 'published' THEN FALSE ELSE is_pinned END,
        moderated_at = NOW(),
        moderated_by = v_caller_id,
        moderation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_post_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'post_id', p_post_id,
        'status', p_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_gym_post(UUID, TEXT, TEXT) TO authenticated;


-- 6C. MODERATE / REMOVE COMMENT
CREATE OR REPLACE FUNCTION public.moderate_gym_comment(
    p_comment_id UUID,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_comment RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    IF p_status NOT IN ('published', 'hidden', 'removed') THEN
        RAISE EXCEPTION 'Invalid status for comment moderation' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO v_comment
    FROM public.gym_comments
    WHERE id = p_comment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comment not found' USING ERRCODE = '40400';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g WHERE g.id = v_comment.gym_id AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the facility owner' USING ERRCODE = '40300';
    END IF;

    UPDATE public.gym_comments
    SET status = p_status,
        moderated_at = NOW(),
        moderated_by = v_caller_id,
        moderation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_comment_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'comment_id', p_comment_id,
        'status', p_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_gym_comment(UUID, TEXT, TEXT) TO authenticated;


-- 6D. RESOLVE GYM POST REPORT
CREATE OR REPLACE FUNCTION public.resolve_gym_post_report(
    p_report_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_action_target BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_report RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    IF p_status NOT IN ('reviewed', 'dismissed', 'action_taken') THEN
        RAISE EXCEPTION 'Invalid status for report resolution' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO v_report
    FROM public.gym_post_reports
    WHERE id = p_report_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report not found' USING ERRCODE = '40400';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g WHERE g.id = v_report.gym_id AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the facility owner' USING ERRCODE = '40300';
    END IF;

    -- Update report status
    UPDATE public.gym_post_reports
    SET status = p_status,
        reviewed_at = NOW(),
        reviewed_by = v_caller_id,
        resolution_notes = p_notes
    WHERE id = p_report_id;

    -- If owner chose to take action directly on the offending target content:
    IF p_action_target = TRUE THEN
        IF v_report.target_type = 'post' AND v_report.post_id IS NOT NULL THEN
            UPDATE public.gym_posts
            SET status = 'removed',
                is_pinned = FALSE,
                moderated_at = NOW(),
                moderated_by = v_caller_id,
                moderation_reason = COALESCE(p_notes, 'Removed following member violation report'),
                updated_at = NOW()
            WHERE id = v_report.post_id;
        ELSIF v_report.target_type = 'comment' AND v_report.comment_id IS NOT NULL THEN
            UPDATE public.gym_comments
            SET status = 'removed',
                moderated_at = NOW(),
                moderated_by = v_caller_id,
                moderation_reason = COALESCE(p_notes, 'Removed following member violation report'),
                updated_at = NOW()
            WHERE id = v_report.comment_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'report_id', p_report_id,
        'status', p_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_gym_post_report(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
