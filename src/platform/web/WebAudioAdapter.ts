import { IPlatformAudio } from '../contracts/audio.interface';
import { logger } from '@/lib/logger';

/**
 * Web implementation of IPlatformAudio using Web Audio API and navigator.vibrate.
 */
export class WebAudioAdapter implements IPlatformAudio {
  private ctx: AudioContext | null = null;

  /**
   * Initializes or resumes the shared AudioContext from a synchronous user gesture.
   * Safe to call multiple times; reuses existing context.
   */
  unlockAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(err => {
          logger.warn('WebAudioAdapter: AudioContext resume failed', { err });
        });
      }
    } catch (err) {
      logger.warn('WebAudioAdapter: unlockAudio error', { err });
    }
  }

  playRestTimerChime(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const ctx = this.ctx;
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
    } catch (err) {
      logger.warn('WebAudioAdapter: AudioContext unavailable or autoplay blocked', { err });
    }
  }

  vibrate(pattern: number | number[] = [200, 100, 200]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        logger.warn('WebAudioAdapter: Vibration restricted or unsupported', { err });
      }
    }
  }

  setDocumentTitle(title: string): void {
    if (typeof document !== 'undefined') {
      document.title = title;
    }
  }
}

export const webAudio = new WebAudioAdapter();
