import React from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, ArrowRight, ShieldCheck, Flame, Utensils, CheckCircle2 } from 'lucide-react';
import { PRODUCT_NAME } from '@/config/branding';
import { SEOHead } from '@/components/common/SEOHead';

export const HowItWorksView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) var(--space-12)' }}>
      <SEOHead
        title={`How ${PRODUCT_NAME} Works — Training Methodology`}
        description="A structured, science-backed approach to hypertrophy, progressive strength, and sustainable training."
        canonicalPath="/how-it-works"
      />
      {/* Header */}
      <div style={{ maxWidth: '720px', margin: '0 auto var(--space-10)', textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>System Methodology</span>
        <h1>How {PRODUCT_NAME} Works</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
          A structured, science-backed approach to hypertrophy, progressive strength, and sustainable training.
        </p>
      </div>

      {/* Deep Dive Pillars */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        {/* Pillar 1 */}
        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ padding: '10px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <Dumbbell size={22} />
            </div>
            <div>
              <small style={{ color: 'var(--accent-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PILLAR 1</small>
              <h3 style={{ fontSize: '1.25rem' }}>Personalized Biometrics & Split Design</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-3)' }}>
            Generic 6-day routines set natural lifters up for systemic fatigue and injury. {PRODUCT_NAME} assesses your weekly schedule (3 to 6 days), your experience level, available equipment (Barbell, Dumbbells, Cables, Bodyweight), and your primary goal (Hypertrophy, Strength, or Conditioning).
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="var(--accent-primary)" /> Push / Pull / Legs (5-Day progressive split)
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="var(--accent-primary)" /> Upper / Lower (4-Day balanced athletic split)
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={16} color="var(--accent-primary)" /> Full Body (3-Day foundational split for maximum recovery)
            </li>
          </ul>
        </div>

        {/* Pillar 2 */}
        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ padding: '10px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <Flame size={22} />
            </div>
            <div>
              <small style={{ color: 'var(--accent-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PILLAR 2</small>
              <h3 style={{ fontSize: '1.25rem' }}>Conservative Progressive Overload</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Progressive overload is the fundamental driver of muscle hypertrophy. When you log workouts in the tracker, the system analyzes your previous weight, completed reps, and Rating of Perceived Exertion (RPE). When you complete all prescribed sets at the upper rep target with RPE ≤ 8, the engine cues a calibrated +2.5kg (upper body) or +5kg (lower body) progression.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ padding: '10px', background: 'rgba(127, 166, 107, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)' }}>
              <Utensils size={22} />
            </div>
            <div>
              <small style={{ color: 'var(--color-success)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PILLAR 3</small>
              <h3 style={{ fontSize: '1.25rem' }}>Tailored Nutrition & Macro Science</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Most generic apps fail Indian and vegetarian lifters because they lack realistic whole-food profiles. {PRODUCT_NAME} integrates accurate macronutrient references for paneer, soya chunks, dal, curd, chicken breast, and eggs. Daily protein targets are calculated at 1.6g - 2.2g per kg of bodyweight, ensuring you hit hypertrophy thresholds without unnecessary supplementation.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ padding: '10px', background: 'var(--accent-gold-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-gold)' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <small style={{ color: 'var(--accent-gold)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PILLAR 4</small>
              <h3 style={{ fontSize: '1.25rem' }}>Verified Personal Records & Integrity</h3>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Personal records are earned, never awarded arbitrarily. Your 1-Rep Max estimations are derived using the validated Brzycki formula from verified completed workout sessions. Track all-time records across bench press, squat, deadlift, and overhead movements.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <Link
            to="/signup"
            className="btn btn-primary btn-lg"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Start Your Journey <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};
