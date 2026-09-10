import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workout.service';
import { streakService } from '@/services/streak.service';
import { nutritionService } from '@/services/nutrition.service';
import { WorkoutPlan, WorkoutPlanDay, WorkoutSession } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile } from '@/types/nutrition.types';
import { DashboardView } from './DashboardView';
import { GuruJiChatDrawer } from '@/features/guru-ji/GuruJiChatDrawer';

export const AppDashboardRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isGuruJiOpen, setIsGuruJiOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadAppData = async () => {
      try {
        const [plan, str, nut, sessions, coinBal] = await Promise.all([
          workoutService.getActivePlan(userId),
          streakService.getStreak(userId),
          nutritionService.getNutritionProfile(userId),
          workoutService.getWorkoutHistory(userId, 5),
          streakService.getCoinBalance(userId),
        ]);

        if (isMounted) {
          // Explicitly NO silent default plan creation! If null, remains null.
          setActivePlan(plan);
          setStreak(str);
          setNutritionProfile(nut);
          setRecentSessions(sessions);
          setCoins(coinBal);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAppData();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading training dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <DashboardView
        activePlan={activePlan}
        streak={streak}
        nutritionProfile={nutritionProfile}
        recentSessions={recentSessions}
        coins={coins}
        session={session}
        onStartWorkout={(day?: WorkoutPlanDay) => {
          navigate(day ? `/app/workouts/active?dayId=${day.id}` : '/app/workouts/active');
        }}
        onOpenGuruJi={() => setIsGuruJiOpen(true)}
      />

      <GuruJiChatDrawer
        isOpen={isGuruJiOpen}
        onClose={() => setIsGuruJiOpen(false)}
        onNavigateTab={tab => {
          setIsGuruJiOpen(false);
          if (tab === 'dashboard') navigate('/app');
          else if (tab === 'workout') navigate('/app/workouts');
          else if (tab === 'exercises') navigate('/app/exercises');
          else if (tab === 'nutrition') navigate('/app/nutrition');
          else if (tab === 'progress') navigate('/app/progress');
          else if (tab === 'streaks') navigate('/app/progress');
          else if (tab === 'onboarding') navigate('/app/profile');
        }}
      />
    </>
  );
};

