import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutPlanDay } from '@/types/workout.types';
import { WorkoutsHubView } from './WorkoutsHubView';

export const WorkoutsRouteView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <WorkoutsHubView
      onStartWorkoutWithDay={(day: WorkoutPlanDay, durationMinutes?: number) => {
        const query = durationMinutes && durationMinutes < 60
          ? `dayId=${day.id}&duration=${durationMinutes}`
          : `dayId=${day.id}`;
        navigate(`/app/workouts/active?${query}`);
      }}
      onStartQuickWorkoutWithDay={(day: WorkoutPlanDay) => {
        navigate(`/app/workouts/active?dayId=${day.id}&duration=20`);
      }}
    />
  );
};
