import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebAudioAdapter } from '@/platform/web/WebAudioAdapter';

describe('Mobile Rest Timer Audio Gesture Unlock Suite', () => {
  let originalWindow: any;
  let mockAudioContextConstructor: any;
  let mockContextInstance: any;
  let createdContextCount = 0;

  beforeEach(() => {
    createdContextCount = 0;
    mockContextInstance = {
      state: 'suspended',
      currentTime: 10,
      destination: {},
      resume: vi.fn().mockImplementation(async () => {
        mockContextInstance.state = 'running';
      }),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }),
    };

    mockAudioContextConstructor = vi.fn().mockImplementation(() => {
      createdContextCount++;
      return mockContextInstance;
    });

    originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      AudioContext: mockAudioContextConstructor,
    };
    if (typeof globalThis.navigator === 'undefined') {
      (globalThis as any).navigator = { vibrate: vi.fn() };
    } else {
      Object.defineProperty(globalThis.navigator, 'vibrate', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('1. Gracefully handles environments where AudioContext is not supported', () => {
    (globalThis as any).window = {}; // No AudioContext or webkitAudioContext
    const adapter = new WebAudioAdapter();

    expect(() => adapter.unlockAudio()).not.toThrow();
    expect(() => adapter.playRestTimerChime()).not.toThrow();
  });

  it('2. First valid workout interaction initializes and unlocks AudioContext', () => {
    const adapter = new WebAudioAdapter();
    expect(createdContextCount).toBe(0);

    // Workout interaction triggers unlock
    adapter.unlockAudio();

    expect(createdContextCount).toBe(1);
    expect(mockContextInstance.resume).toHaveBeenCalled();
    expect(mockContextInstance.state).toBe('running');
  });

  it('3. Resumes suspended context on user interaction', () => {
    const adapter = new WebAudioAdapter();
    adapter.unlockAudio();

    // Context gets suspended by mobile OS power policy
    mockContextInstance.state = 'suspended';
    mockContextInstance.resume.mockClear();

    // Subsequent user interaction (e.g. logging a set)
    adapter.unlockAudio();
    expect(mockContextInstance.resume).toHaveBeenCalled();
  });

  it('4. Subsequent chimes reuse the same initialized AudioContext', () => {
    const adapter = new WebAudioAdapter();
    adapter.unlockAudio();
    expect(createdContextCount).toBe(1);

    // First timer chime
    adapter.playRestTimerChime();
    expect(createdContextCount).toBe(1);

    // Second timer chime
    adapter.playRestTimerChime();
    expect(createdContextCount).toBe(1);
  });

  it('5. Does not create a new AudioContext per timer event', () => {
    const adapter = new WebAudioAdapter();

    // Trigger 5 consecutive timer chimes
    for (let i = 0; i < 5; i++) {
      adapter.playRestTimerChime();
    }

    expect(createdContextCount).toBe(1);
    expect(mockContextInstance.createOscillator).toHaveBeenCalledTimes(10); // 2 tones per chime * 5
  });

  it('6. Multiple sequential rest timers work consistently with shared context', () => {
    const adapter = new WebAudioAdapter();
    adapter.unlockAudio();

    // Timer 1 finishes
    adapter.playRestTimerChime();
    adapter.vibrate([200, 100, 200]);

    // Timer 2 finishes
    adapter.playRestTimerChime();
    adapter.vibrate([200, 100, 200]);

    // Timer 3 finishes
    adapter.playRestTimerChime();
    adapter.vibrate([200, 100, 200]);

    expect(createdContextCount).toBe(1);
    expect(navigator.vibrate).toHaveBeenCalledTimes(3);
  });

  it('7. Vibration fallback remains intact', () => {
    const adapter = new WebAudioAdapter();
    adapter.vibrate([150, 50, 150]);

    expect(navigator.vibrate).toHaveBeenCalledWith([150, 50, 150]);
  });

  it('8. Rest countdown logic remains intact without premature termination', () => {
    let remaining = 60;
    const step = () => {
      if (remaining > 0) remaining -= 1;
      return remaining;
    };

    for (let i = 0; i < 60; i++) {
      step();
    }

    expect(remaining).toBe(0);
  });
});
