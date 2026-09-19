# FitBoost Phase G7: API Contract — Operations Intelligence RPC

## RPC Definition
- **Function**: `public.get_owner_dashboard_overview(p_gym_id UUID)`
- **Language**: PL/pgSQL
- **Security**: `SECURITY DEFINER SET search_path = public, pg_temp;`
- **Access Boundary**: Accessible only by the authenticated owner of the specified facility (`auth.uid() = gyms.owner_id`).

---

## JSON Response Contract

```json
{
  "facility": {
    "gymId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "gymName": "Metropolis Iron Club",
    "timezone": "Asia/Kolkata",
    "maxCapacity": 120
  },
  "live": {
    "occupancy": 42,
    "occupancyRate": 35.0,
    "status": "normal"
  },
  "attendance": {
    "todayCheckins": 118,
    "todayCompletedVisits": 76,
    "todayAvgDurationMinutes": 64.5,
    "peakHoursDistribution": [
      { "hour": 0, "checkins": 0 },
      { "hour": 1, "checkins": 0 },
      { "hour": 2, "checkins": 0 },
      { "hour": 3, "checkins": 0 },
      { "hour": 4, "checkins": 0 },
      { "hour": 5, "checkins": 8 },
      { "hour": 6, "checkins": 25 },
      { "hour": 7, "checkins": 42 },
      { "hour": 8, "checkins": 30 },
      { "hour": 9, "checkins": 15 },
      { "hour": 10, "checkins": 10 },
      { "hour": 11, "checkins": 12 },
      { "hour": 12, "checkins": 18 },
      { "hour": 13, "checkins": 14 },
      { "hour": 14, "checkins": 8 },
      { "hour": 15, "checkins": 12 },
      { "hour": 16, "checkins": 22 },
      { "hour": 17, "checkins": 48 },
      { "hour": 18, "checkins": 72 },
      { "hour": 19, "checkins": 65 },
      { "hour": 20, "checkins": 40 },
      { "hour": 21, "checkins": 20 },
      { "hour": 22, "checkins": 5 },
      { "hour": 23, "checkins": 1 }
    ]
  },
  "members": {
    "activeMembers30d": 245,
    "streakMembersCount": 68,
    "retentionHealthPercentage": 27.8,
    "pendingMembershipsCount": 3
  },
  "engagement": {
    "activeChallengesCount": 2,
    "challengeParticipantsCount": 54,
    "activeBuddyConnectionsCount": 19
  },
  "safety": {
    "openSafetyIncidentsCount": 1,
    "criticalSafetyIncidentsCount": 0,
    "activeSafetyNoticesCount": 2
  },
  "moderation": {
    "unresolvedFlagsCount": 0
  }
}
```

---

## TypeScript Interfaces

```typescript
export interface OwnerDashboardPeakHourBucket {
  hour: number;
  checkins: number;
}

export interface OwnerDashboardFacilityInfo {
  gymId: string;
  gymName: string;
  timezone: string;
  maxCapacity: number;
}

export interface OwnerDashboardLiveMetrics {
  occupancy: number;
  occupancyRate: number;
  status: 'normal' | 'crowded' | 'at_capacity';
}

export interface OwnerDashboardAttendanceMetrics {
  todayCheckins: number;
  todayCompletedVisits: number;
  todayAvgDurationMinutes: number;
  peakHoursDistribution: OwnerDashboardPeakHourBucket[];
}

export interface OwnerDashboardMemberMetrics {
  activeMembers30d: number;
  streakMembersCount: number;
  retentionHealthPercentage: number;
  pendingMembershipsCount: number;
}

export interface OwnerDashboardEngagementMetrics {
  activeChallengesCount: number;
  challengeParticipantsCount: number;
  activeBuddyConnectionsCount: number;
}

export interface OwnerDashboardSafetyMetrics {
  openSafetyIncidentsCount: number;
  criticalSafetyIncidentsCount: number;
  activeSafetyNoticesCount: number;
}

export interface OwnerDashboardModerationMetrics {
  unresolvedFlagsCount: number;
}

export interface OwnerDashboardOverview {
  facility: OwnerDashboardFacilityInfo;
  live: OwnerDashboardLiveMetrics;
  attendance: OwnerDashboardAttendanceMetrics;
  members: OwnerDashboardMemberMetrics;
  engagement: OwnerDashboardEngagementMetrics;
  safety: OwnerDashboardSafetyMetrics;
  moderation: OwnerDashboardModerationMetrics;
}
```
