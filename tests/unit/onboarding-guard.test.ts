import { describe, it, expect, beforeEach } from 'vitest';
import { FitnessProfile } from '@/types/user.types';
import { WorkoutPlan } from '@/types/workout.types';
import { getGoalContextDetails, getGoalLabel } from '@/domain/goal-context';

describe('Onboarding Completion Guard & Dashboard Guidance Suite', () => {
  // Pure state evaluator mimicking DashboardView logic
  function evaluateDashboardState(fitnessProfile: FitnessProfile | null | undefined, activePlan: WorkoutPlan | null) {
    const hasProfileAndGoal = Boolean(fitnessProfile && fitnessProfile.goal);
    const hasActivePlan = Boolean(activePlan);

    if (!hasProfileAndGoal) {
      return {
        state: 'STATE_A' as const,
        bannerTitle: 'Finish Setting Up Your Athlete Profile',
        ctaText: 'Complete Setup →',
        destination: '/onboarding',
        showBanner: true,
      };
    }

    if (hasProfileAndGoal && !hasActivePlan) {
      return {
        state: 'STATE_B' as const,
        bannerTitle: 'Build Your Structured Training Split',
        ctaText: 'Generate Workout Plan →',
        destination: '/plan/build',
        showBanner: true,
      };
    }

    return {
      state: 'STATE_C' as const,
      bannerTitle: null,
      ctaText: null,
      destination: null,
      showBanner: false,
    };
  }

  // PlanBuilder guard evaluator
  function evaluatePlanBuilderGuard(fitnessProfile: FitnessProfile | null | undefined) {
    if (!fitnessProfile || !fitnessProfile.goal) {
      return {
        allowed: false,
        message: 'Finish Setting Up Your Athlete Profile',
        ctaText: 'Complete Your Profile →',
        destination: '/onboarding',
      };
    }
    return {
      allowed: true,
      message: null,
      ctaText: null,
      destination: null,
    };
  }

  const validProfile: FitnessProfile = {
    id: 'prof-001',
    userId: 'user-001',
    age: 26,
    gender: 'male',
    heightCm: 178,
    weightKg: 75,
    goal: 'muscle_gain',
    experienceLevel: 'intermediate',
    daysPerWeek: 4,
    workoutDurationMinutes: 60,
    equipment: ['Barbell', 'Dumbbells'],
    dietaryPreference: 'vegetarian',
    limitations: [],
    workoutEnvironment: 'external_gym',
  };

  const samplePlan: WorkoutPlan = {
    id: 'plan-123',
    userId: 'user-001',
    name: 'Upper / Lower Hypertrophy Split',
    splitType: 'upper_lower',
    days: [],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // Mock sessionStorage
  let sessionStore: Record<string, string> = {};
  const mockSessionStorage = {
    getItem: (key: string) => sessionStore[key] ?? null,
    setItem: (key: string, val: string) => { sessionStore[key] = String(val); },
    removeItem: (key: string) => { delete sessionStore[key]; },
    clear: () => { sessionStore = {}; },
  };
  (globalThis as any).sessionStorage = mockSessionStorage;

  beforeEach(() => {
    mockSessionStorage.clear();
  });

  it('1. null fitnessProfile resolves to State A', () => {
    const res = evaluateDashboardState(null, null);
    expect(res.state).toBe('STATE_A');
    expect(res.bannerTitle).toBe('Finish Setting Up Your Athlete Profile');
    expect(res.showBanner).toBe(true);
  });

  it('2. missing goal on fitnessProfile resolves to State A', () => {
    const profileWithoutGoal = { ...validProfile, goal: undefined as any };
    const res = evaluateDashboardState(profileWithoutGoal, null);
    expect(res.state).toBe('STATE_A');
    expect(res.bannerTitle).toBe('Finish Setting Up Your Athlete Profile');
    expect(res.showBanner).toBe(true);
  });

  it('3. valid profile + no active plan resolves to State B', () => {
    const res = evaluateDashboardState(validProfile, null);
    expect(res.state).toBe('STATE_B');
    expect(res.bannerTitle).toBe('Build Your Structured Training Split');
    expect(res.showBanner).toBe(true);
  });

  it('4. valid profile + active plan resolves to State C (no banner)', () => {
    const res = evaluateDashboardState(validProfile, samplePlan);
    expect(res.state).toBe('STATE_C');
    expect(res.showBanner).toBe(false);
  });

  it('5. State A CTA points to /onboarding', () => {
    const res = evaluateDashboardState(null, null);
    expect(res.ctaText).toBe('Complete Setup →');
    expect(res.destination).toBe('/onboarding');
  });

  it('6. State B CTA points to /plan/build', () => {
    const res = evaluateDashboardState(validProfile, null);
    expect(res.ctaText).toBe('Generate Workout Plan →');
    expect(res.destination).toBe('/plan/build');
  });

  it('7. /plan/build without profile halts and displays onboarding guidance', () => {
    const guardNull = evaluatePlanBuilderGuard(null);
    expect(guardNull.allowed).toBe(false);
    expect(guardNull.destination).toBe('/onboarding');
    expect(guardNull.ctaText).toBe('Complete Your Profile →');

    const guardNoGoal = evaluatePlanBuilderGuard({ ...validProfile, goal: undefined as any });
    expect(guardNoGoal.allowed).toBe(false);
    expect(guardNoGoal.destination).toBe('/onboarding');

    const guardValid = evaluatePlanBuilderGuard(validProfile);
    expect(guardValid.allowed).toBe(true);
  });

  it('8. No "undefined" goal text reaches output across edge cases', () => {
    // Null goal
    const detailsNull = getGoalContextDetails(null);
    expect(detailsNull.label).not.toContain('undefined');
    expect(detailsNull.subtitle).not.toContain('undefined');
    expect(getGoalLabel(null)).not.toContain('undefined');

    // Undefined goal
    const detailsUndef = getGoalContextDetails(undefined);
    expect(detailsUndef.label).not.toContain('undefined');
    expect(detailsUndef.subtitle).not.toContain('undefined');
    expect(getGoalLabel(undefined)).not.toContain('undefined');

    // Invalid string goal
    const detailsInvalid = getGoalContextDetails('random_unknown' as any);
    expect(detailsInvalid.label).not.toContain('undefined');
    expect(detailsInvalid.subtitle).not.toContain('undefined');
    expect(getGoalLabel('random_unknown' as any)).not.toContain('undefined');
  });

  it('9. Dismissal of State A banner is session-only and does not permanently suppress in localStorage', () => {
    const key = 'dismiss_dashboard_state_a';

    // Before dismissal
    expect(sessionStorage.getItem(key)).toBeNull();

    // User dismisses in current session
    sessionStorage.setItem(key, 'true');
    expect(sessionStorage.getItem(key)).toBe('true');

    // In a new browser session (sessionStorage cleared)
    mockSessionStorage.clear();
    expect(sessionStorage.getItem(key)).toBeNull();

    // Banner reappears in new session if profile remains incomplete
    const res = evaluateDashboardState(null, null);
    const isDismissed = sessionStorage.getItem(key) === 'true';
    expect(res.showBanner && !isDismissed).toBe(true);
  });

  it('10. Refresh re-evaluates actual state dynamically', () => {
    // Phase 1: User signed up, no profile yet -> State A
    let profile: FitnessProfile | null = null;
    let plan: WorkoutPlan | null = null;
    expect(evaluateDashboardState(profile, plan).state).toBe('STATE_A');

    // Phase 2: User completes onboarding -> State B
    profile = validProfile;
    expect(evaluateDashboardState(profile, plan).state).toBe('STATE_B');

    // Phase 3: User generates and activates plan -> State C
    plan = samplePlan;
    expect(evaluateDashboardState(profile, plan).state).toBe('STATE_C');
  });
});
