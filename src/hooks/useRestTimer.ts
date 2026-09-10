import { useState, useEffect, useRef } from 'react';

export function useRestTimer() {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);

  const startTimer = (durationSeconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsRemaining(durationSeconds);
    setIsActive(true);
  };

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSecondsRemaining(0);
    setIsActive(false);
  };

  const addTime = (extraSeconds = 30) => {
    setSecondsRemaining(prev => prev + extraSeconds);
  };

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setIsActive(false);
            // Trigger device vibration if supported
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

  return {
    secondsRemaining,
    isActive,
    startTimer,
    stopTimer,
    addTime,
  };
}
