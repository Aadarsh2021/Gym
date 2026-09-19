import { useState, useEffect, useRef, useCallback } from 'react';
import { platform } from '@/platform';

export function useRestTimer() {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);

  const startTimer = useCallback((durationSeconds: number) => {
    platform.audio.unlockAudio?.();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotalDuration(durationSeconds);
    setSecondsRemaining(durationSeconds);
    setIsActive(true);
    setIsPaused(false);
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    platform.audio.unlockAudio?.();
    if (isActive && secondsRemaining > 0) {
      setIsPaused(false);
    }
  }, [isActive, secondsRemaining]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsRemaining(0);
    setTotalDuration(0);
    setIsActive(false);
    setIsPaused(false);
  }, []);

  const addTime = useCallback((extraSeconds = 30) => {
    setSecondsRemaining(prev => prev + extraSeconds);
    setTotalDuration(prev => Math.max(prev, prev + extraSeconds));
  }, []);

  const subtractTime = useCallback((minusSeconds = 15) => {
    setSecondsRemaining(prev => Math.max(0, prev - minusSeconds));
  }, []);

  useEffect(() => {
    if (isActive && !isPaused && secondsRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsActive(false);
            setIsPaused(false);

            // 1. Play platform rest timer completion chime
            platform.audio.playRestTimerChime();

            // 2. Trigger platform haptic vibration
            platform.audio.vibrate([200, 100, 200]);

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, isPaused, secondsRemaining]);

  const progressFraction = totalDuration > 0 ? (totalDuration - secondsRemaining) / totalDuration : 0;

  return {
    secondsRemaining,
    totalDuration,
    progressFraction,
    isActive,
    isPaused,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    addTime,
    subtractTime,
  };
}
