import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workout.service';
import { streakService } from '@/services/streak.service';
import { nutritionService } from '@/services/nutrition.service';
import { foodDiaryService } from '@/services/food-diary.service';
import { profileService } from '@/services/profile.service';
import { WorkoutPlan, WorkoutPlanDay, WorkoutSession } from '@/types/workout.types';
import { UserStreak } from '@/types/streak.types';
import { NutritionProfile, DailyMacroTotals } from '@/types/nutrition.types';
import { FitnessProfile } from '@/types/user.types';
import { getTodayIST } from '@/utils/date';
import { DashboardView } from './DashboardView';

export const AppDashboardRouteView: React.FC = () => {
  const { session } = useAuth();
  const userId = session.user?.id || 'guest-user';
  const navigate = useNavigate();

  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null);
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile | null>(null);
  const [dailyTotals, setDailyTotals] = useState<DailyMacroTotals | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const todayStr = getTodayIST();
    const loadAppData = async () => {
      try {
        const [plan, str, nut, totals, sessions, coinBal, fitProfile] = await Promise.all([
          workoutService.getActivePlan(userId),
          streakService.getStreak(userId),
          nutritionService.getNutritionProfile(userId),
          foodDiaryService.getDailyMacroTotals(userId, todayStr),
          workoutService.getWorkoutHistory(userId, 5),
          streakService.getCoinBalance(userId),
          profileService.getFitnessProfile(userId),
        ]);

        if (isMounted) {
          // Explicitly NO silent default plan creation! If null, remains null.
          setActivePlan(plan);
          setStreak(str);
          setNutritionProfile(nut);
          setFitnessProfile(fitProfile);
          setDailyTotals(totals);
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
    <DashboardView
      activePlan={activePlan}
      streak={streak}
      nutritionProfile={nutritionProfile}
      fitnessProfile={fitnessProfile}
      dailyTotals={dailyTotals || undefined}
      recentSessions={recentSessions}
      coins={coins}
      session={session}
      onStartWorkout={(day?: WorkoutPlanDay, gymVerified?: boolean) => {
        const query = [
          day ? `dayId=${day.id}` : '',
          gymVerified ? 'gymVerified=1' : '',
        ].filter(Boolean).join('&');
        navigate(query ? `/app/workouts/active?${query}` : '/app/workouts/active');
      }}
      onStartQuickWorkout={(day?: WorkoutPlanDay, gymVerified?: boolean) => {
        const query = [
          day ? `dayId=${day.id}` : '',
          'mode=quick',
          gymVerified ? 'gymVerified=1' : '',
        ].filter(Boolean).join('&');
        navigate(`/app/workouts/active?${query}`);
      }}
    />
  );
};

