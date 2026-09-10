import React, { useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { Exercise, WorkoutPlan } from '@/types/workout.types';
import { ExperienceLevel, FitnessGoal } from '@/types/user.types';
import { generateWorkoutPlan } from '@/domain/workout-generator';
import { workoutService } from '@/services/workout.service';

interface WorkoutGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  availableExercises: Exercise[];
  onPlanGenerated: (plan: WorkoutPlan) => void;
}

export const WorkoutGeneratorModal: React.FC<WorkoutGeneratorModalProps> = ({
  isOpen,
  onClose,
  userId,
  availableExercises,
  onPlanGenerated,
}) => {
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [equipment, setEquipment] = useState<string[]>(['Barbell', 'Dumbbells', 'Bodyweight']);
  const [goal, setGoal] = useState<FitnessGoal>('muscle_gain');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toggleEquipment = (item: string) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter(e => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const generated = generateWorkoutPlan({
        daysPerWeek,
        experienceLevel,
        equipment,
        goal,
        availableExercises,
      });

      const saved = await workoutService.saveGeneratedPlan(userId, generated);
      if (saved) {
        onPlanGenerated(saved);
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ padding: '8px', background: 'rgba(212, 255, 0, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3>Algorithmic Plan Generator</h3>
              <small>Builds structured, science-backed workout splits</small>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Days Per Week */}
        <div className="input-group">
          <label className="label">Training Frequency ({daysPerWeek} days / week)</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {[3, 4, 5, 6].map(d => (
              <button
                key={d}
                type="button"
                className={`btn ${daysPerWeek === d ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: 0 }}
                onClick={() => setDaysPerWeek(d)}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>

        {/* Goal & Experience */}
        <div className="grid grid-cols-2" style={{ gap: 'var(--space-2)' }}>
          <div className="input-group">
            <label className="label">Primary Goal</label>
            <select className="select" value={goal} onChange={e => setGoal(e.target.value as FitnessGoal)}>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="fat_loss">Fat Loss</option>
              <option value="strength">Strength</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div className="input-group">
            <label className="label">Experience Level</label>
            <select className="select" value={experienceLevel} onChange={e => setExperienceLevel(e.target.value as ExperienceLevel)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Equipment */}
        <div className="input-group">
          <label className="label">Select Available Equipment</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
            {['Barbell', 'Dumbbells', 'Cable', 'Bodyweight', 'Machines'].map(eq => {
              const selected = equipment.includes(eq);
              return (
                <div
                  key={eq}
                  onClick={() => toggleEquipment(eq)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                    backgroundColor: selected ? 'rgba(212, 255, 0, 0.08)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.9rem' }}>{eq}</span>
                  {selected && <Check size={16} color="var(--accent-primary)" />}
                </div>
              );
            })}
          </div>
        </div>

        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={handleGenerate}
          disabled={loading}
          style={{ marginTop: 'var(--space-4)' }}
        >
          {loading ? <span className="spinner" /> : 'Generate & Activate Routine'}
        </button>
      </div>
    </div>
  );
};
