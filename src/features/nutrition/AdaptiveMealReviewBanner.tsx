import React, { useState, useMemo } from 'react';
import {
  Scale,
  Sparkles,
  ArrowRight,
  RotateCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { MealPlan, NutritionProfile } from '@/types/nutrition.types';
import { ProgressEntry, progressService } from '@/services/progress.service';
import { calculateAdaptiveMealReview, AdaptiveReviewCalculation } from '@/domain/adaptive-meal-planner';
import { nutritionService } from '@/services/nutrition.service';

interface AdaptiveMealReviewBannerProps {
  userId: string;
  activePlan: MealPlan;
  nutritionProfile?: NutritionProfile | null;
  progressEntries: ProgressEntry[];
  userDietaryPreference?: string;
  onPlanUpdated: (newPlan: MealPlan) => void;
  onWeightLogged?: (newWeight: number) => void;
}

export const AdaptiveMealReviewBanner: React.FC<AdaptiveMealReviewBannerProps> = ({
  userId,
  activePlan,
  progressEntries,
  userDietaryPreference = 'vegetarian',
  onPlanUpdated,
  onWeightLogged,
}) => {

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [updatingWeight, setUpdatingWeight] = useState<boolean>(false);
  const [newWeightInput, setNewWeightInput] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [confirmStep, setConfirmStep] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const snoozeStorageKey = `meal_plan_review_snoozed_until_${userId}`;
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(() => {
    return localStorage.getItem(snoozeStorageKey);
  });

  const isCurrentlySnoozed = useMemo(() => {
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil).getTime() > Date.now();
  }, [snoozedUntil]);

  const handleSnoozeOneWeek = () => {
    const oneWeekLater = new Date(Date.now() + 7 * 86400000).toISOString();
    localStorage.setItem(snoozeStorageKey, oneWeekLater);
    setSnoozedUntil(oneWeekLater);
    setIsDismissed(true);
  };

  // Extract previous vs current weight
  const { currentWeight, previousWeight } = useMemo(() => {
    if (!progressEntries || progressEntries.length === 0) {
      return { currentWeight: null, previousWeight: null };
    }
    const sorted = [...progressEntries].sort(
      (a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime()
    );
    const curr = sorted[sorted.length - 1]?.weightKg ?? null;
    const prev = sorted.length > 1 ? sorted[0]?.weightKg ?? curr : curr;
    return { currentWeight: curr, previousWeight: prev };
  }, [progressEntries]);

  // Compute deterministic review state
  const review = useMemo<AdaptiveReviewCalculation>(() => {
    const planCreation = activePlan.createdAt || new Date(Date.now() - 15 * 86400000).toISOString();
    return calculateAdaptiveMealReview({
      planCreatedAt: planCreation,
      currentCalories: activePlan.targetCalories,
      currentProteinG: activePlan.targetProteinG,
      previousWeightKg: previousWeight,
      currentWeightKg: currentWeight,
      profile: {
        gender: 'male',
        fitnessGoal: 'fat_loss',
        activityLevel: 'moderately_active',
      },
      reviewWindowDays: 14,
    });
  }, [activePlan, currentWeight, previousWeight]);

  if (!review.isDue || isDismissed || isCurrentlySnoozed) {
    return null;
  }


  const handleQuickWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeightInput);
    if (isNaN(val) || val < 30 || val > 300) return;

    setUpdatingWeight(true);
    try {
      const res = await progressService.logWeight(userId, val);
      if (res.success) {
        if (onWeightLogged) onWeightLogged(val);
        setStatusMessage(`Weight updated to ${val} kg. Reassessing targets...`);
        setNewWeightInput('');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } finally {
      setUpdatingWeight(false);
    }
  };

  const handleConfirmRegenerate = async () => {
    setIsRegenerating(true);
    try {
      // Regenerate deterministic plan with updated calories & protein
      const updated = await nutritionService.generateAndSaveMealPlan(
        userId,
        review.recommendedCalories,
        review.recommendedProteinG,
        userDietaryPreference
      );
      if (updated) {
        onPlanUpdated(updated);
        setStatusMessage('Your meal plan has been adaptively updated and activated!');
        setConfirmStep(false);
        setIsExpanded(false);
      }
    } catch {
      setStatusMessage('Failed to update meal plan. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div
      className="card card-elevated"
      style={{
        border: '1px solid var(--accent-primary-border)',
        background: 'linear-gradient(180deg, var(--bg-surface) 0%, rgba(59, 130, 246, 0.04) 100%)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}
    >
      {/* Top Banner Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-primary-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                Your meal plan is ready for a progress review
              </strong>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                Adaptive V1
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Plan age: <strong>{review.planAgeDays} days</strong> ({review.planAgeWeeks} weeks) • Weight change:{' '}
              <strong style={{ color: review.weightDeltaKg < 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                {review.weightDeltaKg > 0 ? `+${review.weightDeltaKg}` : `${review.weightDeltaKg}`} kg
              </strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
          >
            <span>{isExpanded ? 'Hide Details' : 'Review Progress'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsDismissed(true)}
            style={{ padding: '4px', color: 'var(--text-muted)' }}
            title="Snooze for this session"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--accent-primary-muted)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={15} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Expanded Progress & Reassessment Review Drawer */}
      {isExpanded && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {/* Rationale explanation */}
          <div
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              background: 'var(--bg-primary)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <strong>Adaptive Assessment:</strong> {review.rationale}
          </div>

          {/* Current vs Proposed Changes Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            {/* Weight Metrics */}
            <div
              style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                Recorded Weight
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {review.currentWeightKg ? `${review.currentWeightKg} kg` : 'Not logged'}
                </span>
                {review.previousWeightKg && review.currentWeightKg && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      color: review.weightDeltaKg <= 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    {review.weightDeltaKg <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    {review.weightDeltaKg > 0 ? `+${review.weightDeltaKg}` : review.weightDeltaKg} kg
                  </span>
                )}
              </div>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Baseline: {review.previousWeightKg ?? '—'} kg
              </small>
            </div>

            {/* Calorie Target Adjustment */}
            <div
              style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                Daily Calorie Target
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {review.recommendedCalories} kcal
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    color: review.calorieDelta !== 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  ({review.calorieDelta > 0 ? `+${review.calorieDelta}` : review.calorieDelta} kcal)
                </span>
              </div>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Current plan: {review.currentCalories} kcal
              </small>
            </div>

            {/* Protein Target Adjustment */}
            <div
              style={{
                background: 'var(--bg-primary)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                Daily Protein Target
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {review.recommendedProteinG}g
                </span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    color: review.proteinDelta !== 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  ({review.proteinDelta > 0 ? `+${review.proteinDelta}` : review.proteinDelta}g)
                </span>
              </div>
              <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Current plan: {review.currentProteinG}g
              </small>
            </div>
          </div>

          {/* Inline Weight Update Form */}
          <form
            onSubmit={handleQuickWeightSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
              background: 'var(--bg-primary)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Scale size={16} color="var(--accent-primary)" />
            <label htmlFor="adaptive-weight-input" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Update Today's Bodyweight:
            </label>
            <input
              id="adaptive-weight-input"
              type="number"
              step="0.1"
              min="35"
              max="250"
              placeholder="e.g. 72.5"
              value={newWeightInput}
              onChange={e => setNewWeightInput(e.target.value)}
              className="input input-sm"
              style={{ width: '110px', fontFamily: 'var(--font-mono)' }}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={updatingWeight || !newWeightInput}
              style={{ fontSize: '0.78rem' }}
            >
              {updatingWeight ? 'Saving...' : 'Save & Re-evaluate'}
            </button>
          </form>

          {/* Confirmation & Action Controls */}
          {!confirmStep ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleSnoozeOneWeek}
              >
                Keep Current Plan for 1 Week
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setConfirmStep(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Recalculate & Update Plan</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--accent-primary-muted)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-primary-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                Are you ready to activate this updated plan ({review.recommendedCalories} kcal • {review.recommendedProteinG}g protein)? Your current plan will be replaced.
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmStep(false)}
                  disabled={isRegenerating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConfirmRegenerate}
                  disabled={isRegenerating}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCw size={14} className={isRegenerating ? 'spin' : ''} />
                  <span>{isRegenerating ? 'Updating Plan...' : 'Yes, Confirm & Activate Plan'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
