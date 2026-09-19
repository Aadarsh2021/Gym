# Phase G7: Architecture & System Design — Gym Owner Operations Intelligence

## 1. System Architecture Overview

Phase G7 implements a high-performance, authoritative analytics layer for facility owners. Rather than querying 7 separate subsystem endpoints over PostgREST, G7 introduces a unified server-side stored procedure: `public.get_owner_dashboard_overview(p_gym_id UUID)`.

```mermaid
flowchart TD
    subgraph Client Layer [Owner Front-End Console: /owner/dashboard]
        UI[OwnerDashboardView]
        Hook[useOwnerGym]
        Svc[OwnerDashboardService]
        Repo[GymRepository]
    end

    subgraph Transport [Supabase PostgREST Gateway]
        RPC_Call["POST /rpc/get_owner_dashboard_overview { p_gym_id }"]
    end

    subgraph Database Layer [PostgreSQL Engine (SECURITY DEFINER)]
        AuthCheck{"Verify auth.uid() == gyms.owner_id"}
        TZ["Determine facility timezone (gyms.timezone)"]
        
        subgraph Subsystem Queries [Parallel Execution in Single DB Transaction]
            Q1["Live Occupancy & Completed Visits (gym_attendance_sessions)"]
            Q2["Hourly Distribution 0..23 (gym_attendance_sessions)"]
            Q3["Membership Breakdown (gym_memberships)"]
            Q4["Streaks & Retention (gym_attendance_streaks)"]
            Q5["Operational Alerts: Safety, Members, Moderation (incidents, memberships, reports)"]
            Q6["Engagement: Challenges, Buddies, Rewards (challenges, buddy_conns, redemptions)"]
        end
        
        PackJson["jsonb_build_object(...)"]
    end

    UI --> Hook
    UI --> Svc
    Svc --> Repo
    Repo --> RPC_Call
    RPC_Call --> AuthCheck
    AuthCheck -- Pass --> TZ
    AuthCheck -- Fail --> Err["Raise 40301 Unauthorized"]
    TZ --> SubsystemQueries
    SubsystemQueries --> PackJson
    PackJson --> RPC_Call
    RPC_Call --> Repo
    Repo --> Svc
    Svc --> UI
```

---

## 2. Authoritative Database RPC Design

### 2.1 RPC: `public.get_owner_dashboard_overview(p_gym_id UUID)`
- **Security Context**: `SECURITY DEFINER`
- **Execution Engine**: `plpgsql`
- **Search Path**: `SET search_path = public, auth`
- **Transaction Scope**: Single atomic read-only transaction.
- **Estimated Execution Time**: 8–15ms on PostgreSQL with index scans.

```sql
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_overview(
    p_gym_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_gym RECORD;
    v_tz TEXT;
    v_today_start TIMESTAMPTZ;
    v_today_end TIMESTAMPTZ;
    v_week_start TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
    
    -- Metrics
    v_live_occupancy INT;
    v_today_checkins INT;
    v_today_completed INT;
    v_today_avg_duration_mins NUMERIC(8,1);
    
    v_members_active INT;
    v_members_pending INT;
    v_members_frozen INT;
    v_members_inactive INT;
    v_members_total INT;
    
    v_alert_pending_members INT;
    v_alert_open_incidents INT;
    v_alert_critical_incidents INT;
    v_alert_active_notices INT;
    v_alert_pending_reports INT;
    
    v_streak_active_athletes INT;
    v_streak_avg_length NUMERIC(8,1);
    v_streak_max_length INT;
    
    v_active_challenges INT;
    v_total_challenge_participants INT;
    v_posts_past_7_days INT;
    v_opted_in_buddies INT;
    v_active_buddy_pairs INT;
    v_rewards_redeemed_past_30_days INT;
    
    v_peak_hours JSONB;
BEGIN
    -- 1. Authentication Check
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '40100';
    END IF;

    -- 2. Authorization & Facility Existence Check
    SELECT * INTO v_gym
    FROM public.gyms
    WHERE id = p_gym_id AND owner_id = v_caller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the verified owner of this facility' USING ERRCODE = '40301';
    END IF;

    -- 3. Compute Facility-Local Calendar Time Boundaries
    v_tz := COALESCE(v_gym.timezone, 'Asia/Kolkata');
    v_today_start := (NOW() AT TIME ZONE v_tz)::DATE::TIMESTAMPTZ AT TIME ZONE v_tz;
    v_today_end := v_today_start + INTERVAL '1 day';
    v_week_start := v_today_start - INTERVAL '7 days';
    v_month_start := v_today_start - INTERVAL '30 days';

    -- 4. Attendance & Live Occupancy Metrics
    SELECT COUNT(*) INTO v_live_occupancy
    FROM public.gym_attendance_sessions
    WHERE gym_id = p_gym_id AND status = 'active' AND check_out_at IS NULL;

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COALESCE(ROUND(AVG(duration_seconds) FILTER (WHERE status = 'completed') / 60.0, 1), 0.0)
    INTO v_today_checkins, v_today_completed, v_today_avg_duration_mins
    FROM public.gym_attendance_sessions
    WHERE gym_id = p_gym_id
      AND check_in_at >= v_today_start
      AND check_in_at < v_today_end;

    -- 5. Peak Hours: Hourly check-in distribution (0..23) for the local calendar day
    WITH hours AS (
        SELECT generate_series(0, 23) AS hr
    ),
    checkin_counts AS (
        SELECT 
            EXTRACT(HOUR FROM check_in_at AT TIME ZONE v_tz)::INT AS hr,
            COUNT(*) AS cnt
        FROM public.gym_attendance_sessions
        WHERE gym_id = p_gym_id
          AND check_in_at >= v_today_start
          AND check_in_at < v_today_end
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'hour', h.hr,
            'count', COALESCE(c.cnt, 0)
        ) ORDER BY h.hr ASC
    ) INTO v_peak_hours
    FROM hours h
    LEFT JOIN checkin_counts c ON c.hr = h.hr;

    -- 6. Membership Breakdown
    SELECT 
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'frozen'),
        COUNT(*) FILTER (WHERE status = 'inactive'),
        COUNT(*)
    INTO v_members_active, v_members_pending, v_members_frozen, v_members_inactive, v_members_total
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id;

    -- 7. Operational Attention Alerts
    v_alert_pending_members := v_members_pending;

    SELECT 
        COUNT(*) FILTER (WHERE status IN ('reported', 'acknowledged', 'investigating')),
        COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved', 'dismissed'))
    INTO v_alert_open_incidents, v_alert_critical_incidents
    FROM public.gym_safety_incidents
    WHERE gym_id = p_gym_id;

    SELECT COUNT(*) INTO v_alert_active_notices
    FROM public.gym_safety_notices
    WHERE gym_id = p_gym_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW());

    SELECT COUNT(*) INTO v_alert_pending_reports
    FROM public.gym_post_reports
    WHERE gym_id = p_gym_id AND status = 'pending';

    -- 8. Retention & Streaks
    SELECT 
        COUNT(*) FILTER (WHERE current_streak >= 2),
        COALESCE(ROUND(AVG(current_streak) FILTER (WHERE current_streak >= 2), 1), 0.0),
        COALESCE(MAX(longest_streak), 0)
    INTO v_streak_active_athletes, v_streak_avg_length, v_streak_max_length
    FROM public.gym_attendance_streaks
    WHERE gym_id = p_gym_id;

    -- 9. Subsystem Engagement Summaries
    SELECT 
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active'),
        COUNT(p.user_id) FILTER (WHERE c.status = 'active')
    INTO v_active_challenges, v_total_challenge_participants
    FROM public.gym_challenges c
    LEFT JOIN public.gym_challenge_participants p ON p.challenge_id = c.id
    WHERE c.gym_id = p_gym_id;

    SELECT COUNT(*) INTO v_posts_past_7_days
    FROM public.gym_posts
    WHERE gym_id = p_gym_id
      AND status = 'published'
      AND created_at >= v_week_start;

    SELECT COUNT(*) INTO v_opted_in_buddies
    FROM public.gym_buddy_preferences
    WHERE gym_id = p_gym_id AND is_opted_in = TRUE;

    SELECT COUNT(*) INTO v_active_buddy_pairs
    FROM public.gym_buddy_connections
    WHERE gym_id = p_gym_id AND status = 'accepted';

    SELECT COUNT(*) INTO v_rewards_redeemed_past_30_days
    FROM public.gym_reward_redemptions r
    JOIN public.gym_rewards w ON w.id = r.reward_id
    WHERE w.gym_id = p_gym_id
      AND r.redeemed_at >= v_month_start;

    -- 10. Assemble & Return Canonical Dashboard Payload
    RETURN jsonb_build_object(
        'gym_id', p_gym_id,
        'timezone', v_tz,
        'generated_at', NOW(),
        'occupancy', jsonb_build_object(
            'live_occupancy', v_live_occupancy,
            'today_checkins', v_today_checkins,
            'today_completed_visits', v_today_completed,
            'today_avg_duration_minutes', v_today_avg_duration_mins,
            'capacity_limit', v_gym.capacity_limit
        ),
        'memberships', jsonb_build_object(
            'active', v_members_active,
            'pending', v_members_pending,
            'frozen', v_members_frozen,
            'inactive', v_members_inactive,
            'total', v_members_total
        ),
        'operational_alerts', jsonb_build_object(
            'pending_members_count', v_alert_pending_members,
            'open_safety_incidents_count', v_alert_open_incidents,
            'critical_safety_incidents_count', v_alert_critical_incidents,
            'active_safety_notices_count', v_alert_active_notices,
            'pending_content_reports_count', v_alert_pending_reports,
            'total_action_items_count', (
                v_alert_pending_members + v_alert_open_incidents + v_alert_pending_reports
            )
        ),
        'retention', jsonb_build_object(
            'active_streak_athletes_count', v_streak_active_athletes,
            'average_streak_length', v_streak_avg_length,
            'facility_record_streak', v_streak_max_length
        ),
        'engagement', jsonb_build_object(
            'active_challenges_count', v_active_challenges,
            'challenge_participants_count', v_total_challenge_participants,
            'posts_past_7_days_count', v_posts_past_7_days,
            'buddy_opted_in_count', v_opted_in_buddies,
            'active_buddy_connections_count', v_active_buddy_pairs,
            'reward_redemptions_past_30_days_count', v_rewards_redeemed_past_30_days
        ),
        'peak_hours', v_peak_hours
    );
END;
$$;
```

---

## 3. Client Architecture & Data Flow

```
[OwnerDashboardView]
       │
       ├─ (mount & 20s interval) ──► ownerDashboardService.getOperationsOverview(activeGym.id)
       │                                     │
       │                                     ▼
       │                              gymRepository.fetchOperationsOverview(gymId)
       │                                     │
       │                                     ▼
       │                              supabase.rpc('get_owner_dashboard_overview', { p_gym_id })
       │
       ├─ (tab = 'floor') ─────────► ownerDashboardService.getLiveFloorRoster(activeGym.id)
       │
       └─ (tab = 'ledger') ────────► ownerDashboardService.getCompletedAttendanceLedger(activeGym.id, filter)
```

1. **Top Operations Hub**: Driven strictly by `get_owner_dashboard_overview`. Refreshed every 20 seconds.
2. **Floor Tab**: Renders individual live attendance sessions. Shows athlete name, duration ticker, and G6 emergency contact lookup.
3. **Ledger Tab**: Paginated attendance audit trail with search and date filters.

---

## 4. Performance & Scalability Analysis

| Facility Scale | Active Sessions | Total Members | Sessions/Day | Expected Query Duration |
| :--- | :--- | :--- | :--- | :--- |
| **Boutique Gym** | 10 – 25 | 100 – 300 | 50 – 150 | ~5 – 8ms |
| **Mid-Size Gym** | 50 – 120 | 1,000 – 2,500 | 400 – 800 | ~10 – 15ms |
| **Large Commercial Facility**| 200 – 400 | 5,000 – 10,000| 1,500 – 3,000 | ~15 – 25ms |

All queries utilize existing partial indexes:
- `idx_attendance_sessions_gym_status`
- `idx_gym_safety_incidents_facility`
- `idx_gym_memberships_gym_status`
- `idx_gym_attendance_streaks_gym_user`
- `idx_gym_posts_owner_mod`
- `idx_gym_post_reports_gym_status`
