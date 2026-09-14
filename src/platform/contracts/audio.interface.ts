/**
 * Platform Audio & Haptic Feedback Contract
 * Abstracts audio alerts and vibration across Web and Mobile.
 */
export interface IPlatformAudio {
  playRestTimerChime(): Promise<void> | void;
  vibrate(pattern?: number | number[]): void;
  setDocumentTitle?(title: string): void;
}
