# ADR-002: Facility-Local Timezone Anchored Aggregations

## Status
Accepted

## Context
In multi-tenant operations, gym facilities operate within distinct geographic regions and physical timezones (e.g., `'Asia/Kolkata'`, `'America/New_York'`, `'UTC'`). 
A classic flaw in multi-tenant analytics dashboards is relying on:
1. Browser client local time (`new Date().setHours(0,0,0,0)`), which results in different operators viewing different metric windows for the same gym depending on where their laptop or phone is located.
2. Server UTC timestamp truncation (`date_trunc('day', created_at)` in UTC), which misattributes early morning or late night gym sessions to the wrong business calendar day (e.g., 6:00 AM IST is 00:30 UTC, whereas 11:30 PM IST is 18:00 UTC previous day).

G1 established the facility-local timezone authority stored in `public.gyms.timezone`.

## Decision
All date and hour boundaries in Phase G7 aggregation calculations MUST be computed server-side in PostgreSQL using the facility's registered timezone:
```sql
v_tz := COALESCE((SELECT timezone FROM public.gyms WHERE id = p_gym_id), 'Asia/Kolkata');
v_today_start := (date_trunc('day', timezone(v_tz, now())) AT TIME ZONE v_tz);
v_today_end := v_today_start + interval '1 day';
v_seven_days_ago := v_today_start - interval '6 days';
v_thirty_days_ago := v_today_start - interval '29 days';
```

Furthermore, hourly distribution buckets for peak hour utilization will be extracted using:
```sql
EXTRACT(HOUR FROM timezone(v_tz, check_in_time))
```
This guarantees that 5:00 PM to 8:00 PM represents 5:00 PM to 8:00 PM local gym time, regardless of whether the owner is looking at the dashboard from London, New York, or Tokyo.

## Consequences
- **Positive**: 100% deterministic, audit-consistent attendance and visit counts across all devices and shifts.
- **Positive**: Eliminates client clock drift and timezone misconfiguration bugs.
- **Negative/Tradeoff**: PostgreSQL timezone conversions add minor string lookup overhead, safely mitigated by indexing `timezone` on `public.gyms` or caching in the RPC local variable `v_tz`.
