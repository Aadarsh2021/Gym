-- ==============================================================================
-- FITBOOST GYM V1 — PHASE G6: GYM SAFETY & SPS (SAFETY & PROTECTION SYSTEM)
-- Migration: 20260924000001_gym_safety_and_sps.sql
--
-- Capabilities:
-- 1. gym_safety_incidents: Facility hazard, incident, & harassment tracking
-- 2. gym_safety_incident_logs: Tamper-proof, append-only immutable audit trail (ON DELETE RESTRICT)
-- 3. gym_emergency_contacts: Next-of-kin emergency contact store with active floor attendance gating
-- 4. gym_safety_notices: High-visibility hazard warnings & floor advisories
-- 5. Authoritative RPCs (9 functions):
--    - report_gym_safety_incident()
--    - trigger_gym_emergency_sos()
--    - get_my_gym_safety_incidents()
--    - set_gym_emergency_contact()
--    - get_gym_safety_incidents()
--    - get_active_member_emergency_contact()
--    - update_safety_incident_status()
--    - get_safety_incident_audit_trail()
--    - publish_gym_safety_notice()
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GYM SAFETY INCIDENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'equipment_hazard',
            'facility_hazard',
            'medical_emergency',
            'member_harassment',
            'theft_security',
            'sanitation_hygiene',
            'other'
        )
    ),
    severity TEXT NOT NULL CHECK (
        severity IN ('critical', 'high', 'medium', 'low')
    ),
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
    description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 2000),
    location_in_facility TEXT CHECK (location_in_facility IS NULL OR char_length(trim(location_in_facility)) <= 120),
    reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    attendance_session_id UUID REFERENCES public.gym_attendance_sessions(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'reported' NOT NULL CHECK (
        status IN (
            'reported',
            'acknowledged',
            'investigating',
            'action_taken',
            'resolved',
            'dismissed'
        )
    ),
    resolution_notes TEXT CHECK (resolution_notes IS NULL OR char_length(trim(resolution_notes)) <= 2000),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_no_self_report CHECK (reported_user_id IS NULL OR reported_user_id != reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_gym_status 
ON public.gym_safety_incidents (gym_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_reporter 
ON public.gym_safety_incidents (reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_reported_user 
ON public.gym_safety_incidents (reported_user_id) 
WHERE reported_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_safety_incidents_session
ON public.gym_safety_incidents (attendance_session_id)
WHERE attendance_session_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.gym_safety_incidents ENABLE ROW LEVEL SECURITY;

-- 2. RLS POLICIES FOR gym_safety_incidents
-- A. SELECT: Reporter can view ONLY their own reports.
--    FACILITY OWNERS ARE DENIED DIRECT SELECT TO PREVENT COLUMN LEAKAGE OF ANONYMOUS reporter_id.
--    REPORTED PARTIES ARE DENIED DIRECT SELECT (ZERO READ ACCESS).
DROP POLICY IF EXISTS "Reporters view own safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Reporters view own safety incidents"
ON public.gym_safety_incidents FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- B. INSERT: Denied directly (must route through report_gym_safety_incident RPC)
DROP POLICY IF EXISTS "Deny direct client insert on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client insert on safety incidents"
ON public.gym_safety_incidents FOR INSERT
TO authenticated
WITH CHECK (FALSE);

-- C. UPDATE: Denied directly (must route through update_safety_incident_status RPC)
DROP POLICY IF EXISTS "Deny direct client update on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client update on safety incidents"
ON public.gym_safety_incidents FOR UPDATE
TO authenticated
USING (FALSE);

-- D. DELETE: Denied permanently for legal / liability / insurance retention
DROP POLICY IF EXISTS "Deny direct client delete on safety incidents" ON public.gym_safety_incidents;
CREATE POLICY "Deny direct client delete on safety incidents"
ON public.gym_safety_incidents FOR DELETE
TO authenticated
USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. GYM SAFETY INCIDENT LOGS (APPEND-ONLY IMMUTABLE AUDIT LEDGER)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_safety_incident_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.gym_safety_incidents(id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (
        action IN (
            'created',
            'status_change',
            'note_added',
            'escalated',
            'resolved',
            'dismissed'
        )
    ),
    previous_status TEXT,
    new_status TEXT,
    notes TEXT CHECK (notes IS NULL OR char_length(trim(notes)) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_incident_logs_parent 
ON public.gym_safety_incident_logs (incident_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.gym_safety_incident_logs ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access on audit logs (Zero direct client read or mutation)
DROP POLICY IF EXISTS "Deny direct client select on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client select on incident logs"
ON public.gym_safety_incident_logs FOR SELECT
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client insert on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client insert on incident logs"
ON public.gym_safety_incident_logs FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client update on incident logs"
ON public.gym_safety_incident_logs FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on incident logs" ON public.gym_safety_incident_logs;
CREATE POLICY "Deny direct client delete on incident logs"
ON public.gym_safety_incident_logs FOR DELETE
TO authenticated
USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GYM EMERGENCY CONTACTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL CHECK (char_length(trim(contact_name)) BETWEEN 2 AND 100),
    relationship TEXT NOT NULL CHECK (char_length(trim(relationship)) BETWEEN 2 AND 50),
    phone_number TEXT NOT NULL CHECK (char_length(trim(phone_number)) BETWEEN 7 AND 20),
    alternative_phone TEXT CHECK (alternative_phone IS NULL OR char_length(trim(alternative_phone)) BETWEEN 7 AND 20),
    medical_notes TEXT CHECK (medical_notes IS NULL OR char_length(trim(medical_notes)) <= 500),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_emergency_contact UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
ON public.gym_emergency_contacts (user_id);

-- Enable RLS
ALTER TABLE public.gym_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Member manages their own emergency contact only.
-- OWNERS ARE DENIED DIRECT SELECT TO PREVENT VOYEURISTIC BROWSING.
-- OWNER RETRIEVAL IS RPC-ONLY GATED BY ACTIVE FLOOR ATTENDANCE.
DROP POLICY IF EXISTS "Members view own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members view own emergency contact"
ON public.gym_emergency_contacts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members insert own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members insert own emergency contact"
ON public.gym_emergency_contacts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members update own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members update own emergency contact"
ON public.gym_emergency_contacts FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own emergency contact" ON public.gym_emergency_contacts;
CREATE POLICY "Members delete own emergency contact"
ON public.gym_emergency_contacts FOR DELETE
TO authenticated
USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4B. GYM EMERGENCY CONTACT ACCESS LOGS TABLE (AUDIT OF SENSITIVE ACCESS)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_emergency_contact_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
    member_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    viewer_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    attendance_session_id UUID NOT NULL REFERENCES public.gym_attendance_sessions(id) ON DELETE RESTRICT,
    accessed_fields TEXT[] DEFAULT ARRAY['contact_name', 'relationship', 'phone_number', 'alternative_phone', 'medical_notes'] NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_access_gym 
ON public.gym_emergency_contact_access_logs (gym_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_access_member 
ON public.gym_emergency_contact_access_logs (member_user_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_access_viewer 
ON public.gym_emergency_contact_access_logs (viewer_owner_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_access_session 
ON public.gym_emergency_contact_access_logs (attendance_session_id);

-- Enable RLS
ALTER TABLE public.gym_emergency_contact_access_logs ENABLE ROW LEVEL SECURITY;

-- Member can view who accessed their own emergency contact
DROP POLICY IF EXISTS "Members view access logs for own contact" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Members view access logs for own contact"
ON public.gym_emergency_contact_access_logs FOR SELECT
TO authenticated
USING (member_user_id = auth.uid());

-- Direct client mutations strictly denied (appended exclusively by get_active_member_emergency_contact RPC)
DROP POLICY IF EXISTS "Deny direct insert on emergency contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct insert on emergency contact access logs"
ON public.gym_emergency_contact_access_logs FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct update on emergency contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct update on emergency contact access logs"
ON public.gym_emergency_contact_access_logs FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct delete on emergency contact access logs" ON public.gym_emergency_contact_access_logs;
CREATE POLICY "Deny direct delete on emergency contact access logs"
ON public.gym_emergency_contact_access_logs FOR DELETE
TO authenticated
USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GYM SAFETY NOTICES TABLE (FLOOR ADVISORIES)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_safety_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 5 AND 2000),
    notice_type TEXT NOT NULL CHECK (
        notice_type IN (
            'hazard_warning',
            'maintenance_closure',
            'safety_guideline',
            'emergency_advisory'
        )
    ),
    severity TEXT NOT NULL CHECK (
        severity IN ('critical', 'high', 'medium', 'low')
    ),
    affected_area TEXT CHECK (affected_area IS NULL OR char_length(trim(affected_area)) <= 120),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    starts_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_notices_gym_active 
ON public.gym_safety_notices (gym_id, is_active, starts_at DESC);

-- Enable RLS
ALTER TABLE public.gym_safety_notices ENABLE ROW LEVEL SECURITY;

-- Active members of gym and verified gym owner can SELECT
DROP POLICY IF EXISTS "Active members and owners view safety notices" ON public.gym_safety_notices;
CREATE POLICY "Active members and owners view safety notices"
ON public.gym_safety_notices FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.gym_memberships m
        WHERE m.gym_id = gym_safety_notices.gym_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
    )
    OR EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = gym_safety_notices.gym_id
          AND g.owner_id = auth.uid()
    )
);

-- Direct client mutations denied (route through publish_gym_safety_notice RPC)
DROP POLICY IF EXISTS "Deny direct client insert on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client insert on safety notices"
ON public.gym_safety_notices FOR INSERT
TO authenticated
WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny direct client update on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client update on safety notices"
ON public.gym_safety_notices FOR UPDATE
TO authenticated
USING (FALSE);

DROP POLICY IF EXISTS "Deny direct client delete on safety notices" ON public.gym_safety_notices;
CREATE POLICY "Deny direct client delete on safety notices"
ON public.gym_safety_notices FOR DELETE
TO authenticated
USING (FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AUTHORITATIVE RPC 1: report_gym_safety_incident
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_gym_safety_incident(
    p_gym_id UUID,
    p_category TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_description TEXT,
    p_location TEXT DEFAULT NULL,
    p_reported_user_id UUID DEFAULT NULL,
    p_is_anonymous BOOLEAN DEFAULT FALSE,
    p_trigger_block BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_sanitized_title TEXT;
    v_sanitized_description TEXT;
    v_sanitized_location TEXT;
    v_session_id UUID;
    v_recent_reports_count INT;
    v_incident RECORD;
BEGIN
    -- 1. Authentication Check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Verify active membership in supplied gym
    IF NOT EXISTS (
        SELECT 1 FROM public.gym_memberships
        WHERE gym_id = p_gym_id
          AND user_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You must be an active member of this facility to file a safety incident' USING ERRCODE = '40301';
    END IF;

    -- 3. Validate Inputs
    v_sanitized_title := trim(p_title);
    IF v_sanitized_title IS NULL OR char_length(v_sanitized_title) < 3 OR char_length(v_sanitized_title) > 120 THEN
        RAISE EXCEPTION 'Title must be between 3 and 120 characters' USING ERRCODE = '40001';
    END IF;

    v_sanitized_description := trim(p_description);
    IF v_sanitized_description IS NULL OR char_length(v_sanitized_description) < 10 OR char_length(v_sanitized_description) > 2000 THEN
        RAISE EXCEPTION 'Description must be between 10 and 2000 characters' USING ERRCODE = '40001';
    END IF;

    IF p_category NOT IN ('equipment_hazard', 'facility_hazard', 'medical_emergency', 'member_harassment', 'theft_security', 'sanitation_hygiene', 'other') THEN
        RAISE EXCEPTION 'Invalid safety category: %', p_category USING ERRCODE = '40001';
    END IF;

    IF p_severity NOT IN ('critical', 'high', 'medium', 'low') THEN
        RAISE EXCEPTION 'Invalid severity level: %', p_severity USING ERRCODE = '40001';
    END IF;

    IF p_location IS NOT NULL THEN
        v_sanitized_location := trim(p_location);
        IF char_length(v_sanitized_location) > 120 THEN
            RAISE EXCEPTION 'Location cannot exceed 120 characters' USING ERRCODE = '40001';
        END IF;
    END IF;

    -- 4. Check Self-Reporting
    IF p_reported_user_id IS NOT NULL THEN
        IF p_reported_user_id = v_caller_id THEN
            RAISE EXCEPTION 'Cannot report yourself' USING ERRCODE = '40002';
        END IF;

        -- Reported user must have a membership profile or record
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_reported_user_id) THEN
            RAISE EXCEPTION 'Reported user not found' USING ERRCODE = '40401';
        END IF;
    END IF;

    -- 5. Rate-Limiting: Max 5 reports per user per rolling 60 minutes
    SELECT COUNT(*) INTO v_recent_reports_count
    FROM public.gym_safety_incidents
    WHERE reporter_id = v_caller_id
      AND created_at >= NOW() - INTERVAL '60 minutes';

    IF v_recent_reports_count >= 5 THEN
        RAISE EXCEPTION 'Rate limit exceeded: You can submit at most 5 safety reports per hour' USING ERRCODE = '42901';
    END IF;

    -- 6. Capture active attendance session if currently checked in
    SELECT id INTO v_session_id
    FROM public.gym_attendance_sessions
    WHERE user_id = v_caller_id
      AND gym_id = p_gym_id
      AND status = 'active'
      AND check_out_at IS NULL
    ORDER BY check_in_at DESC
    LIMIT 1;

    -- 7. Insert Incident Record
    INSERT INTO public.gym_safety_incidents (
        gym_id,
        reporter_id,
        is_anonymous,
        category,
        severity,
        title,
        description,
        location_in_facility,
        reported_user_id,
        attendance_session_id,
        status,
        created_at,
        updated_at
    )
    VALUES (
        p_gym_id,
        v_caller_id,
        COALESCE(p_is_anonymous, FALSE),
        p_category,
        p_severity,
        v_sanitized_title,
        v_sanitized_description,
        v_sanitized_location,
        p_reported_user_id,
        v_session_id,
        'reported',
        NOW(),
        NOW()
    )
    RETURNING * INTO v_incident;

    -- 8. Append initial immutable audit log entry
    INSERT INTO public.gym_safety_incident_logs (
        incident_id,
        actor_id,
        action,
        previous_status,
        new_status,
        notes,
        created_at
    )
    VALUES (
        v_incident.id,
        v_caller_id,
        'created',
        NULL,
        'reported',
        CASE WHEN COALESCE(p_is_anonymous, FALSE) THEN 'Incident reported (Anonymous Whistleblower)' ELSE 'Incident reported' END,
        NOW()
    );

    -- 9. Automatic G3 Buddy Block (Interpersonal Harassment only)
    IF p_trigger_block = TRUE AND p_reported_user_id IS NOT NULL AND p_category = 'member_harassment' THEN
        INSERT INTO public.gym_buddy_blocks (blocker_id, blocked_id, created_at)
        VALUES (v_caller_id, p_reported_user_id, NOW())
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'id', v_incident.id,
        'gym_id', v_incident.gym_id,
        'status', v_incident.status,
        'severity', v_incident.severity,
        'category', v_incident.category,
        'is_anonymous', v_incident.is_anonymous,
        'created_at', v_incident.created_at
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. AUTHORITATIVE RPC 2: trigger_gym_emergency_sos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_gym_emergency_sos(
    p_location_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_sess_id UUID;
    v_gym_id UUID;
    v_gym_name TEXT;
    v_sanitized_location TEXT;
    v_existing_incident_id UUID;
    v_new_incident RECORD;
BEGIN
    -- 1. Authentication Check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Derive gym_id server-side from active floor attendance session
    SELECT s.id, s.gym_id, g.name INTO v_sess_id, v_gym_id, v_gym_name
    FROM public.gym_attendance_sessions s
    JOIN public.gyms g ON g.id = s.gym_id
    WHERE s.user_id = v_caller_id
      AND s.status = 'active'
      AND s.check_out_at IS NULL
    ORDER BY s.check_in_at DESC
    LIMIT 1;

    IF v_sess_id IS NULL OR v_gym_id IS NULL THEN
        RAISE EXCEPTION 'Active floor attendance session required: You can only trigger an on-floor SOS while checked into a facility' USING ERRCODE = '40302';
    END IF;

    IF p_location_details IS NOT NULL THEN
        v_sanitized_location := trim(p_location_details);
    END IF;

    -- 3. 15-Minute Deduplication Window
    -- Check if an ongoing critical SOS alert already exists for this member at this session
    SELECT id INTO v_existing_incident_id
    FROM public.gym_safety_incidents
    WHERE reporter_id = v_caller_id
      AND gym_id = v_gym_id
      AND category = 'medical_emergency'
      AND severity = 'critical'
      AND status IN ('reported', 'acknowledged', 'investigating')
      AND created_at >= NOW() - INTERVAL '15 minutes'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_incident_id IS NOT NULL THEN
        -- Append supplemental location note if provided
        IF v_sanitized_location IS NOT NULL AND char_length(v_sanitized_location) > 0 THEN
            INSERT INTO public.gym_safety_incident_logs (
                incident_id,
                actor_id,
                action,
                notes,
                created_at
            )
            VALUES (
                v_existing_incident_id,
                v_caller_id,
                'note_added',
                'Repeated SOS trigger update: ' || v_sanitized_location,
                NOW()
            );
        END IF;

        RETURN jsonb_build_object(
            'incident_id', v_existing_incident_id,
            'alert_status', 'already_active',
            'gym_id', v_gym_id,
            'gym_name', v_gym_name,
            'message', 'An active emergency SOS alarm is already being processed by facility staff.'
        );
    END IF;

    -- 4. Create new canonical critical SOS incident
    INSERT INTO public.gym_safety_incidents (
        gym_id,
        reporter_id,
        is_anonymous,
        category,
        severity,
        title,
        description,
        location_in_facility,
        attendance_session_id,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_gym_id,
        v_caller_id,
        FALSE,
        'medical_emergency',
        'critical',
        'EMERGENCY SOS: Floor Assistance Requested',
        'Athlete triggered on-floor Emergency SOS alarm. Immediate staff assistance required.',
        COALESCE(v_sanitized_location, 'Gym Floor'),
        v_sess_id,
        'reported',
        NOW(),
        NOW()
    )
    RETURNING * INTO v_new_incident;

    -- 5. Append audit log
    INSERT INTO public.gym_safety_incident_logs (
        incident_id,
        actor_id,
        action,
        previous_status,
        new_status,
        notes,
        created_at
    )
    VALUES (
        v_new_incident.id,
        v_caller_id,
        'created',
        NULL,
        'reported',
        'CRITICAL EMERGENCY SOS triggered from floor attendance session ' || v_sess_id::text,
        NOW()
    );

    RETURN jsonb_build_object(
        'incident_id', v_new_incident.id,
        'alert_status', 'dispatched',
        'gym_id', v_gym_id,
        'gym_name', v_gym_name,
        'created_at', v_new_incident.created_at
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. AUTHORITATIVE RPC 3: get_my_gym_safety_incidents
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_gym_safety_incidents(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    gym_id UUID,
    gym_name TEXT,
    is_anonymous BOOLEAN,
    category TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    location_in_facility TEXT,
    status TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_bounded_limit INT;
    v_bounded_offset INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    v_bounded_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
    v_bounded_offset := GREATEST(0, COALESCE(p_offset, 0));

    RETURN QUERY
    SELECT 
        i.id,
        i.gym_id,
        g.name AS gym_name,
        i.is_anonymous,
        i.category,
        i.severity,
        i.title,
        i.description,
        i.location_in_facility,
        i.status,
        i.resolution_notes,
        i.resolved_at,
        i.created_at,
        i.updated_at
    FROM public.gym_safety_incidents i
    JOIN public.gyms g ON g.id = i.gym_id
    WHERE i.reporter_id = v_caller_id
    ORDER BY i.created_at DESC
    LIMIT v_bounded_limit
    OFFSET v_bounded_offset;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUTHORITATIVE RPC 4: set_gym_emergency_contact
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_gym_emergency_contact(
    p_contact_name TEXT,
    p_relationship TEXT,
    p_phone_number TEXT,
    p_alternative_phone TEXT DEFAULT NULL,
    p_medical_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_sanitized_name TEXT;
    v_sanitized_rel TEXT;
    v_sanitized_phone TEXT;
    v_sanitized_alt TEXT;
    v_sanitized_notes TEXT;
    v_contact RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    v_sanitized_name := trim(p_contact_name);
    IF v_sanitized_name IS NULL OR char_length(v_sanitized_name) < 2 OR char_length(v_sanitized_name) > 100 THEN
        RAISE EXCEPTION 'Contact name must be between 2 and 100 characters' USING ERRCODE = '40001';
    END IF;

    v_sanitized_rel := trim(p_relationship);
    IF v_sanitized_rel IS NULL OR char_length(v_sanitized_rel) < 2 OR char_length(v_sanitized_rel) > 50 THEN
        RAISE EXCEPTION 'Relationship must be between 2 and 50 characters' USING ERRCODE = '40001';
    END IF;

    v_sanitized_phone := trim(p_phone_number);
    IF v_sanitized_phone IS NULL OR char_length(v_sanitized_phone) < 7 OR char_length(v_sanitized_phone) > 20 THEN
        RAISE EXCEPTION 'Phone number must be between 7 and 20 characters' USING ERRCODE = '40001';
    END IF;

    IF p_alternative_phone IS NOT NULL THEN
        v_sanitized_alt := trim(p_alternative_phone);
        IF char_length(v_sanitized_alt) > 20 THEN
            RAISE EXCEPTION 'Alternative phone cannot exceed 20 characters' USING ERRCODE = '40001';
        END IF;
    END IF;

    IF p_medical_notes IS NOT NULL THEN
        v_sanitized_notes := trim(p_medical_notes);
        IF char_length(v_sanitized_notes) > 500 THEN
            RAISE EXCEPTION 'Medical notes cannot exceed 500 characters' USING ERRCODE = '40001';
        END IF;
    END IF;

    INSERT INTO public.gym_emergency_contacts (
        user_id,
        contact_name,
        relationship,
        phone_number,
        alternative_phone,
        medical_notes,
        created_at,
        updated_at
    )
    VALUES (
        v_caller_id,
        v_sanitized_name,
        v_sanitized_rel,
        v_sanitized_phone,
        v_sanitized_alt,
        v_sanitized_notes,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        contact_name = EXCLUDED.contact_name,
        relationship = EXCLUDED.relationship,
        phone_number = EXCLUDED.phone_number,
        alternative_phone = EXCLUDED.alternative_phone,
        medical_notes = EXCLUDED.medical_notes,
        updated_at = NOW()
    RETURNING * INTO v_contact;

    RETURN jsonb_build_object(
        'id', v_contact.id,
        'user_id', v_contact.user_id,
        'contact_name', v_contact.contact_name,
        'relationship', v_contact.relationship,
        'phone_number', v_contact.phone_number,
        'alternative_phone', v_contact.alternative_phone,
        'medical_notes', v_contact.medical_notes,
        'updated_at', v_contact.updated_at
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. AUTHORITATIVE RPC 5: get_gym_safety_incidents (OWNER TRIAGE QUEUE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gym_safety_incidents(
    p_gym_id UUID,
    p_status_filter TEXT DEFAULT NULL,
    p_severity_filter TEXT DEFAULT NULL,
    p_limit INT DEFAULT 30,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    gym_id UUID,
    reporter_id UUID,
    reporter_name TEXT,
    reporter_avatar_url TEXT,
    is_anonymous BOOLEAN,
    category TEXT,
    severity TEXT,
    title TEXT,
    description TEXT,
    location_in_facility TEXT,
    reported_user_id UUID,
    reported_user_name TEXT,
    attendance_session_id UUID,
    status TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_bounded_limit INT;
    v_bounded_offset INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Verify caller owns the facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = p_gym_id
          AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You are not the owner of this facility' USING ERRCODE = '40301';
    END IF;

    v_bounded_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));
    v_bounded_offset := GREATEST(0, COALESCE(p_offset, 0));

    RETURN QUERY
    SELECT 
        i.id,
        i.gym_id,
        -- ANONYMOUS MASKING: Never expose reporter_id, name, or avatar when is_anonymous is true
        CASE WHEN i.is_anonymous THEN NULL ELSE i.reporter_id END AS reporter_id,
        CASE WHEN i.is_anonymous THEN 'Anonymous Member (Verified Active Membership)' ELSE COALESCE(p.display_name, 'Athlete') END AS reporter_name,
        CASE WHEN i.is_anonymous THEN NULL ELSE p.avatar_url END AS reporter_avatar_url,
        i.is_anonymous,
        i.category,
        i.severity,
        i.title,
        i.description,
        i.location_in_facility,
        i.reported_user_id,
        COALESCE(ru.display_name, 'Member') AS reported_user_name,
        i.attendance_session_id,
        i.status,
        i.resolution_notes,
        i.resolved_at,
        i.created_at,
        i.updated_at
    FROM public.gym_safety_incidents i
    LEFT JOIN public.profiles p ON p.id = i.reporter_id
    LEFT JOIN public.profiles ru ON ru.id = i.reported_user_id
    WHERE i.gym_id = p_gym_id
      AND (p_status_filter IS NULL OR i.status = p_status_filter)
      AND (p_severity_filter IS NULL OR i.severity = p_severity_filter)
    ORDER BY 
      CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END ASC,
      i.created_at DESC
    LIMIT v_bounded_limit
    OFFSET v_bounded_offset;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. AUTHORITATIVE RPC 6: get_active_member_emergency_contact
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_member_emergency_contact(
    p_user_id UUID,
    p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_contact RECORD;
    v_session RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 1. Verify caller owns gym
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = p_gym_id
          AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this facility' USING ERRCODE = '40301';
    END IF;

    -- 2. Verify target member has an ACTIVE attendance session in this exact gym
    SELECT * INTO v_session
    FROM public.gym_attendance_sessions
    WHERE user_id = p_user_id
      AND gym_id = p_gym_id
      AND status = 'active'
      AND check_out_at IS NULL
    ORDER BY check_in_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Member does not have an active floor check-in session at this facility' USING ERRCODE = '40303';
    END IF;

    -- 3. Retrieve contact
    SELECT * INTO v_contact
    FROM public.gym_emergency_contacts
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_contact', FALSE,
            'message', 'Member has not configured an emergency contact.'
        );
    END IF;

    -- 4. Atomically log sensitive emergency contact access
    INSERT INTO public.gym_emergency_contact_access_logs (
        gym_id,
        member_user_id,
        viewer_owner_id,
        attendance_session_id,
        accessed_fields,
        accessed_at
    )
    VALUES (
        p_gym_id,
        p_user_id,
        v_caller_id,
        v_session.id,
        ARRAY['contact_name', 'relationship', 'phone_number', 'alternative_phone', 'medical_notes'],
        NOW()
    );

    RETURN jsonb_build_object(
        'has_contact', TRUE,
        'contact_name', v_contact.contact_name,
        'relationship', v_contact.relationship,
        'phone_number', v_contact.phone_number,
        'alternative_phone', v_contact.alternative_phone,
        'medical_notes', v_contact.medical_notes,
        'session_check_in_at', v_session.check_in_at
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. AUTHORITATIVE RPC 7: update_safety_incident_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_safety_incident_status(
    p_incident_id UUID,
    p_new_status TEXT,
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_incident RECORD;
    v_sanitized_notes TEXT;
    v_resolved_at TIMESTAMPTZ := NULL;
    v_resolved_by UUID := NULL;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Fetch incident
    SELECT * INTO v_incident
    FROM public.gym_safety_incidents
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Safety incident not found' USING ERRCODE = '40401';
    END IF;

    -- Verify caller owns the facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = v_incident.gym_id
          AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You are not the owner of this facility' USING ERRCODE = '40301';
    END IF;

    -- Validate target status
    IF p_new_status NOT IN ('acknowledged', 'investigating', 'action_taken', 'resolved', 'dismissed') THEN
        RAISE EXCEPTION 'Invalid incident status: %', p_new_status USING ERRCODE = '40001';
    END IF;

    -- State machine check: Cannot reopen resolved or dismissed incident
    IF v_incident.status IN ('resolved', 'dismissed') THEN
        RAISE EXCEPTION 'Cannot update incident: Incident is already closed (status: %)', v_incident.status USING ERRCODE = '40003';
    END IF;

    IF p_resolution_notes IS NOT NULL THEN
        v_sanitized_notes := trim(p_resolution_notes);
        IF char_length(v_sanitized_notes) > 2000 THEN
            RAISE EXCEPTION 'Resolution notes cannot exceed 2000 characters' USING ERRCODE = '40001';
        END IF;
    END IF;

    IF p_new_status IN ('resolved', 'dismissed') THEN
        v_resolved_at := NOW();
        v_resolved_by := v_caller_id;
    END IF;

    -- Update incident row
    UPDATE public.gym_safety_incidents
    SET status = p_new_status,
        resolution_notes = COALESCE(v_sanitized_notes, resolution_notes),
        resolved_at = COALESCE(v_resolved_at, resolved_at),
        resolved_by = COALESCE(v_resolved_by, resolved_by),
        updated_at = NOW()
    WHERE id = p_incident_id;

    -- Append immutable audit log row
    INSERT INTO public.gym_safety_incident_logs (
        incident_id,
        actor_id,
        action,
        previous_status,
        new_status,
        notes,
        created_at
    )
    VALUES (
        p_incident_id,
        v_caller_id,
        CASE WHEN p_new_status = 'resolved' THEN 'resolved' WHEN p_new_status = 'dismissed' THEN 'dismissed' ELSE 'status_change' END,
        v_incident.status,
        p_new_status,
        v_sanitized_notes,
        NOW()
    );

    RETURN jsonb_build_object(
        'id', p_incident_id,
        'status', p_new_status,
        'resolution_notes', v_sanitized_notes,
        'resolved_at', v_resolved_at,
        'updated_at', NOW()
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. AUTHORITATIVE RPC 8: get_safety_incident_audit_trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_safety_incident_audit_trail(
    p_incident_id UUID
)
RETURNS TABLE (
    id UUID,
    incident_id UUID,
    actor_id UUID,
    actor_name TEXT,
    action TEXT,
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_incident RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Fetch incident to verify ownership
    SELECT * INTO v_incident
    FROM public.gym_safety_incidents gsi
    WHERE gsi.id = p_incident_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident not found' USING ERRCODE = '40401';
    END IF;

    -- Verify caller owns the facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms g
        WHERE g.id = v_incident.gym_id
          AND g.owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You are not the owner of this facility' USING ERRCODE = '40301';
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.incident_id,
        CASE 
            WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN NULL
            ELSE l.actor_id
        END AS actor_id,
        CASE 
            WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN 'Anonymous Member'
            ELSE COALESCE(p.display_name, 'Staff Member')
        END AS actor_name,
        l.action,
        l.previous_status,
        l.new_status,
        l.notes,
        l.created_at
    FROM public.gym_safety_incident_logs l
    LEFT JOIN public.profiles p ON (
        CASE 
            WHEN v_incident.is_anonymous AND l.actor_id = v_incident.reporter_id THEN NULL
            ELSE l.actor_id
        END
    ) = p.id
    WHERE l.incident_id = p_incident_id
    ORDER BY l.created_at ASC;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. AUTHORITATIVE RPC 9: publish_gym_safety_notice
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_gym_safety_notice(
    p_gym_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_notice_type TEXT,
    p_severity TEXT,
    p_affected_area TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_sanitized_title TEXT;
    v_sanitized_content TEXT;
    v_sanitized_area TEXT;
    v_notice RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- Verify caller owns the facility
    IF NOT EXISTS (
        SELECT 1 FROM public.gyms
        WHERE id = p_gym_id
          AND owner_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You are not the owner of this facility' USING ERRCODE = '40301';
    END IF;

    v_sanitized_title := trim(p_title);
    IF v_sanitized_title IS NULL OR char_length(v_sanitized_title) < 3 OR char_length(v_sanitized_title) > 120 THEN
        RAISE EXCEPTION 'Title must be between 3 and 120 characters' USING ERRCODE = '40001';
    END IF;

    v_sanitized_content := trim(p_content);
    IF v_sanitized_content IS NULL OR char_length(v_sanitized_content) < 5 OR char_length(v_sanitized_content) > 2000 THEN
        RAISE EXCEPTION 'Content must be between 5 and 2000 characters' USING ERRCODE = '40001';
    END IF;

    IF p_notice_type NOT IN ('hazard_warning', 'maintenance_closure', 'safety_guideline', 'emergency_advisory') THEN
        RAISE EXCEPTION 'Invalid notice type: %', p_notice_type USING ERRCODE = '40001';
    END IF;

    IF p_severity NOT IN ('critical', 'high', 'medium', 'low') THEN
        RAISE EXCEPTION 'Invalid severity level: %', p_severity USING ERRCODE = '40001';
    END IF;

    IF p_affected_area IS NOT NULL THEN
        v_sanitized_area := trim(p_affected_area);
        IF char_length(v_sanitized_area) > 120 THEN
            RAISE EXCEPTION 'Affected area cannot exceed 120 characters' USING ERRCODE = '40001';
        END IF;
    END IF;

    INSERT INTO public.gym_safety_notices (
        gym_id,
        author_id,
        title,
        content,
        notice_type,
        severity,
        affected_area,
        is_active,
        starts_at,
        expires_at,
        created_at,
        updated_at
    )
    VALUES (
        p_gym_id,
        v_caller_id,
        v_sanitized_title,
        v_sanitized_content,
        p_notice_type,
        p_severity,
        v_sanitized_area,
        TRUE,
        NOW(),
        p_expires_at,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_notice;

    RETURN jsonb_build_object(
        'id', v_notice.id,
        'gym_id', v_notice.gym_id,
        'title', v_notice.title,
        'notice_type', v_notice.notice_type,
        'severity', v_notice.severity,
        'is_active', v_notice.is_active,
        'starts_at', v_notice.starts_at,
        'expires_at', v_notice.expires_at,
        'created_at', v_notice.created_at
    );
END;
$$;
