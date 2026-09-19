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
      className={`rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 shadow-sm backdrop-blur-sm ${className}`}
      data-testid="workout-alarm-countdown"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Next Workout Alarm</h4>
            <p className="text-xs text-slate-400">
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
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 border border-blue-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Active
        </span>
      </div>

      {snoozeActive && snoozeCountdown ? (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Snooze in Progress</p>
              <p className="text-xs text-amber-400/80">Alarm ringing in {snoozeCountdown}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
            <span className="block text-xl font-bold font-mono text-white" data-testid="countdown-days">
              {countdown.days.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Days</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
            <span className="block text-xl font-bold font-mono text-white" data-testid="countdown-hours">
              {countdown.hours.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Hours</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
            <span className="block text-xl font-bold font-mono text-white" data-testid="countdown-minutes">
              {countdown.minutes.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Mins</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800">
            <span className="block text-xl font-bold font-mono text-blue-400" data-testid="countdown-seconds">
              {countdown.seconds.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Secs</span>
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Volume2 className="h-3.5 w-3.5 text-blue-400" />
          <span>Plays audio chime + system alert</span>
        </div>

        {onSnooze && !snoozeActive && (
          <button
            type="button"
            onClick={onSnooze}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 flex items-center gap-1"
          >
            <Moon className="h-3 w-3" />
            Quick Snooze 10m
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        <AlertCircle className="h-3 w-3 shrink-0 text-slate-400" />
        <span>Alarms trigger while browser tab is open or running in background. Web Push remains V2.</span>
      </div>
    </div>
  );
};
