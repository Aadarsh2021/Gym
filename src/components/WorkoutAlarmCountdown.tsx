import React, { useEffect, useState } from 'react';
import { Clock, AlertCircle, Volume2, Moon } from 'lucide-react';
import { reminderService, WorkoutReminderPreference } from '@/services/reminder.service';

interface WorkoutAlarmCountdownProps {
  preference: WorkoutReminderPreference | null;
  onSnooze?: () => void;
  className?: string;
}

export const WorkoutAlarmCountdown: React.FC<WorkoutAlarmCountdownProps> = ({
  preference,
  onSnooze,
  className = '',
}) => {
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    formatted: string;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    formatted: 'Calculating...',
  });

  const [snoozeActive, setSnoozeActive] = useState<boolean>(false);
  const [snoozeCountdown, setSnoozeCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!preference || !preference.enabled || !preference.days || preference.days.length === 0) {
      setCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        formatted: 'Alarm disabled',
      });
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      
      // Check snooze state
      if (preference.snoozedUntil) {
        const snoozeEnd = new Date(preference.snoozedUntil).getTime();
        const diff = snoozeEnd - now.getTime();
        if (diff > 0) {
          setSnoozeActive(true);
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          setSnoozeCountdown(`${mins}m ${secs.toString().padStart(2, '0')}s`);
          return;
        } else {
          setSnoozeActive(false);
          setSnoozeCountdown(null);
        }
      } else {
        setSnoozeActive(false);
        setSnoozeCountdown(null);
      }

      const msUntil = reminderService.getMillisecondsUntilNextReminder(
        preference.time,
        preference.days,
        now
      );

      const detailed = reminderService.getDetailedCountdown(msUntil);
      setCountdown(detailed);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [preference]);

  if (!preference || !preference.enabled) {
    return null;
  }

  return (
    <div
      className={`card card-elevated ${className}`}
      style={{
        padding: 'var(--space-4)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
      }}
      data-testid="workout-alarm-countdown"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 'var(--space-3)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary-muted)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Clock size={16} />
          </div>
          <div>
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Next Workout Alarm
            </h4>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                margin: '2px 0 0',
              }}
            >
              Scheduled for {preference.time} (
              {preference.days.length === 7
                ? 'Every day'
                : preference.days.length === 5 && !preference.days.includes(6) && !preference.days.includes(7)
                ? 'Mon–Fri'
                : `${preference.days.length} days/week`}
              )
            </p>
          </div>
        </div>

        <span
          className="badge"
          style={{
            background: 'var(--accent-primary-muted)',
            color: 'var(--accent-primary)',
            border: '1px solid rgba(79, 140, 255, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            padding: '2px 8px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-primary)',
              display: 'inline-block',
            }}
          />
          Active
        </span>
      </div>

      {snoozeActive && snoozeCountdown ? (
        <div
          className="card"
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-warning-muted)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Moon size={16} style={{ color: 'var(--color-warning)' }} />
            <div>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-warning)', margin: 0 }}>
                Snooze in Progress
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Alarm ringing in {snoozeCountdown}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 'var(--space-3)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-2)',
            textAlign: 'center',
          }}
        >
          <div
            className="card"
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              data-testid="countdown-days"
              style={{
                display: 'block',
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
              }}
            >
              {countdown.days.toString().padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Days
            </span>
          </div>

          <div
            className="card"
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              data-testid="countdown-hours"
              style={{
                display: 'block',
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
              }}
            >
              {countdown.hours.toString().padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Hours
            </span>
          </div>

          <div
            className="card"
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              data-testid="countdown-minutes"
              style={{
                display: 'block',
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
              }}
            >
              {countdown.minutes.toString().padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Mins
            </span>
          </div>

          <div
            className="card"
            style={{
              padding: 'var(--space-2)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              data-testid="countdown-seconds"
              style={{
                display: 'block',
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-primary)',
              }}
            >
              {countdown.seconds.toString().padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              Secs
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Volume2 size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>Plays audio chime + system alert</span>
        </div>

        {onSnooze && !snoozeActive && (
          <button
            type="button"
            onClick={onSnooze}
            className="btn btn-secondary btn-sm"
            style={{ minHeight: '30px', padding: '2px 10px', fontSize: '0.75rem', gap: '4px' }}
          >
            <Moon size={12} />
            <span>Quick Snooze 10m</span>
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: 'var(--space-2)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
        }}
      >
        <AlertCircle size={13} style={{ flexShrink: 0 }} />
        <span>Alarms trigger while browser tab is open or running in background. Web Push remains V2.</span>
      </div>
    </div>
  );
};
