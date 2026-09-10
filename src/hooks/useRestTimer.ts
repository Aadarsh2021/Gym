import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Web Audio chime player for gym rest timer completion.
 * Pure native Web Audio API: Zero external mp3 dependencies, 100% offline capable.
 */
function playRestTimerChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two-tone gym chime (High ding -> Resolve)
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(784, now, 0.25);        // G5
    playTone(1046.5, now + 0.2, 0.4); // C6
  } catch {
    // AudioContext blocked or not allowed by browser autoplay policy
  }
}

export function useRestTimer() {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);

  const startTimer = useCallback((durationSeconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotalDuration(durationSeconds);
    setSecondsRemaining(durationSeconds);
    setIsActive(true);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsRemaining(0);
    setTotalDuration(0);
    setIsActive(false);
  }, []);

  const addTime = useCallback((extraSeconds = 30) => {
    setSecondsRemaining(prev => prev + extraSeconds);
    setTotalDuration(prev => Math.max(prev, prev + extraSeconds));
  }, []);

  const subtractTime = useCallback((minusSeconds = 15) => {
    setSecondsRemaining(prev => Math.max(0, prev - minusSeconds));
  }, []);

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsActive(false);

            // 1. Play native Web Audio chime
            playRestTimerChime();

            // 2. Trigger mobile haptic vibration if supported
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate([200, 100, 200]);
              } catch {
                // Ignore if browser restricts vibration
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, secondsRemaining]);

  const progressFraction = totalDuration > 0 ? (totalDuration - secondsRemaining) / totalDuration : 0;

  return {
    secondsRemaining,
    totalDuration,
    progressFraction,
    isActive,
    startTimer,
    stopTimer,
    addTime,
    subtractTime,
  };
}
