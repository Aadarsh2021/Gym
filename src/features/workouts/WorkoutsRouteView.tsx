import React from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutPlanDay } from '@/types/workout.types';
import { WorkoutsHubView } from './WorkoutsHubView';

export const WorkoutsRouteView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <WorkoutsHubView
      onStartWorkoutWithDay={(day: WorkoutPlanDay) => {
        navigate(`/app/workouts/active?dayId=${day.id}`);
      }}
      onStartQuickWorkoutWithDay={(day: WorkoutPlanDay) => {
        navigate(`/app/workouts/active?dayId=${day.id}&mode=quick`);
      }}
    />
  );
};
