import { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { WorkoutTrackerView } from '@/features/workout-tracker/WorkoutTrackerView';
import { WorkoutGeneratorModal } from '@/features/workout-generator/WorkoutGeneratorModal';
import { NutritionView } from '@/features/nutrition/NutritionView';
import { ProgressView } from '@/features/progress/ProgressView';
import { StreaksView } from '@/features/streaks/StreaksView';
import { GuruJiChatDrawer } from '@/features/guru-ji/GuruJiChatDrawer';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { AuthModal } from '@/features/auth/AuthModal';
import { PublicCalculatorsModal } from '@/features/seo-pages/PublicCalculatorsModal';

import { workoutService } from '@/services/workout.service';
import { streakService } from '@/services/streak.service';
import { nutritionService } from '@/services/nutrition.service';
import { exerciseService, FALLBACK_EXERCISES } from '@/services/exercise.service';
import { profileService } from '@/services/profile.service';

import { WorkoutPlan, WorkoutSession, Exercise } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile } from '@/types/nutrition.types';
import { FitnessProfile } from '@/types/user.types';
import { loadActiveSessionDraft } from '@/utils/storage';
import { generateWorkoutPlan } from '@/domain/workout-generator';

function MainApp() {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals & Drawers
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isGuruJiOpen, setIsGuruJiOpen] = useState(false);
  const [publicTool, setPublicTool] = useState<string | null>(null);

  // Core Application State
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null);
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>(FALLBACK_EXERCISES);

  // Active Gym Tracking Session
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  // Load User Data
  const loadUserData = async () => {
    try {
      const [exList, plan, str, coins, nutProfile, fitProfile] = await Promise.all([
        exerciseService.getExercises(),
        workoutService.getActivePlan(userId),
        streakService.getStreak(userId),
        streakService.getCoinBalance(userId),
        nutritionService.getNutritionProfile(userId),
        profileService.getFitnessProfile(userId),
      ]);

      setExercises(exList);
      setStreak(str);
      setCoinBalance(coins);
      setNutritionProfile(nutProfile);
      setFitnessProfile(fitProfile);

      if (plan) {
        setActivePlan(plan);
      } else {
        // Automatically generate a foundational starter plan if none exists
        const defaultPlan = generateWorkoutPlan({
          daysPerWeek: 4,
          experienceLevel: 'beginner',
          equipment: ['Barbell', 'Dumbbells', 'Bodyweight'],
          goal: 'muscle_gain',
          availableExercises: exList.length > 0 ? exList : FALLBACK_EXERCISES,
        });
        const saved = await workoutService.saveGeneratedPlan(userId, defaultPlan);
        if (saved) setActivePlan(saved);
      }

      // Check for saved local draft session
      const draft = loadActiveSessionDraft();
      if (draft && draft.status === 'in_progress') {
        setActiveSession(draft);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadUserData();
  }, [userId]);

  // Handle Starting a Workout
  const handleStartWorkout = () => {
    if (!activePlan || !activePlan.days || activePlan.days.length === 0) {
      setIsGeneratorOpen(true);
      return;
    }

    const todayDay = activePlan.days[0];
    const newSession: WorkoutSession = {
      id: `session-${Date.now()}`,
      userId,
      planId: activePlan.id,
      name: todayDay.name,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      exercises: todayDay.exercises.map((wpe, idx) => ({
        exerciseId: wpe.exerciseId,
        exerciseName: wpe.exercise?.name || 'Compound Movement',
        primaryMuscle: wpe.exercise?.primaryMuscle || 'Full Body',
        orderIndex: idx + 1,
        sets: Array.from({ length: wpe.targetSets }, (_, sIdx) => ({
          setIndex: sIdx + 1,
          weightKg: 40,
          reps: wpe.targetRepsMin,
          completed: false,
        })),
      })),
    };

    setActiveSession(newSession);
    setActiveTab('workout');
  };

  // Workout Completion
  const handleFinishWorkout = async (_completionData: any) => {
    setActiveSession(null);
    setActiveTab('progress');
    await loadUserData();
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header
        currentStreak={streak.currentStreak}
        coinBalance={coinBalance}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onNavigateTab={tab => setActiveTab(tab)}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Onboarding View */}
        {activeTab === 'onboarding' ? (
          <OnboardingWizard
            userId={userId}
            existingProfile={fitnessProfile}
            onComplete={() => {
              setActiveTab('dashboard');
              loadUserData();
            }}
          />
        ) : activeSession ? (
          /* Active Workout Tracker Mode */
          <WorkoutTrackerView
            session={activeSession}
            onFinish={handleFinishWorkout}
            onCancel={() => {
              if (confirm('Are you sure you want to exit this active workout session?')) {
                setActiveSession(null);
              }
            }}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            activePlan={activePlan}
            streak={streak}
            nutritionProfile={nutritionProfile}
            onStartWorkout={handleStartWorkout}
            onOpenGuruJi={() => setIsGuruJiOpen(true)}
            onNavigateTab={tab => setActiveTab(tab)}
            onOpenGenerator={() => setIsGeneratorOpen(true)}
          />
        ) : activeTab === 'workout' ? (
          <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <span className="badge badge-lime" style={{ marginBottom: 'var(--space-1)' }}>Workout Hub</span>
                <h1>Active Training Routine</h1>
                <p>Execute your scheduled days or customize your routine split.</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-outline" onClick={() => setIsGeneratorOpen(true)}>
                  Regenerate Split
                </button>
                <button className="btn btn-primary" onClick={handleStartWorkout}>
                  Start Today's Workout
                </button>
              </div>
            </div>

            {activePlan ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
                {activePlan.days.map(day => (
                  <div key={day.id} className="card card-interactive">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span className="badge badge-cyan">Day {day.dayNumber}</span>
                      <small style={{ color: 'var(--text-muted)' }}>{day.exercises.length} Exercises</small>
                    </div>
                    <h3>{day.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                      {day.targetMuscleGroups.join(', ')}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {day.exercises.map((ex, idx) => (
                        <div
                          key={ex.id || idx}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--bg-input)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{ex.exercise?.name || 'Exercise'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{ex.targetSets} × {ex.targetRepsMin}-{ex.targetRepsMax}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p>No active workout plan found.</p>
                <button className="btn btn-primary" onClick={() => setIsGeneratorOpen(true)}>
                  Generate Personalized Plan
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'nutrition' ? (
          <NutritionView nutritionProfile={nutritionProfile} />
        ) : activeTab === 'progress' ? (
          <ProgressView userId={userId} />
        ) : activeTab === 'streaks' ? (
          <StreaksView userId={userId} />
        ) : activeTab === 'guru-ji' ? (
          <div className="container" style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
            <div className="card card-glass" style={{ maxWidth: '500px', margin: '0 auto', padding: 'var(--space-8)' }}>
              <h2>Guru Ji AI Fitness Coach</h2>
              <p style={{ marginTop: 'var(--space-2)' }}>Your contextual assistant for workouts, nutrition, and form guidance.</p>
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={() => setIsGuruJiOpen(true)}
                style={{ marginTop: 'var(--space-6)' }}
              >
                Open Coach Conversation
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer with Public Links & Disclaimer */}
      <Footer onOpenPublicTool={tool => setPublicTool(tool)} />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} onSelectTab={tab => setActiveTab(tab)} />

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => loadUserData()}
      />

      <WorkoutGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        userId={userId}
        availableExercises={exercises}
        onPlanGenerated={plan => setActivePlan(plan)}
      />

      <GuruJiChatDrawer
        isOpen={isGuruJiOpen}
        onClose={() => setIsGuruJiOpen(false)}
        onNavigateTab={tab => setActiveTab(tab)}
      />

      <PublicCalculatorsModal
        isOpen={Boolean(publicTool)}
        initialTool={publicTool || 'bmr-calculator'}
        onClose={() => setPublicTool(null)}
        onStartOnboarding={() => {
          setPublicTool(null);
          setActiveTab('onboarding');
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
