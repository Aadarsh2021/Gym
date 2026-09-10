import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Zap, Target } from 'lucide-react';

export const PublicWorkoutsView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) var(--space-12)' }}>
      {/* Header */}
      <div style={{ maxWidth: '720px', margin: '0 auto var(--space-10)', textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>Training Splits</span>
        <h1>Science-Backed Workout Architecture</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
          Every routine is calculated around muscle recovery windows, mechanical tension, and compound movements.
        </p>
      </div>

      {/* Split Comparison Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
        {/* Full Body */}
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>3 Days / Week</span>
              <small style={{ color: 'var(--text-muted)' }}>Foundational</small>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-3)' }}>Foundational Full Body</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              Ideal for beginners and lifters with demanding schedules. Stimulates major muscle groups 3 times per week with 48 hours of recovery between sessions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Clock size={14} /> 45-60 min per session
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Target size={14} /> Squat, Bench Press, Barbell Row, Core
              </div>
            </div>
          </div>
          <Link to="/signup" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Choose This Split
          </Link>
        </div>

        {/* Upper / Lower */}
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'var(--accent-primary)', background: 'var(--bg-surface-elevated)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>4 Days / Week</span>
              <span className="badge badge-gold">Most Popular</span>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-3)' }}>Athletic Upper / Lower</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              The optimal frequency balance for intermediate lifters. Upper sessions emphasize chest, back, and shoulder power; lower sessions target quad, hamstring, and core stability.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Clock size={14} /> 50-70 min per session
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Target size={14} /> Incline DB Press, Pull-Ups, Deadlift, Squat
              </div>
            </div>
          </div>
          <Link to="/signup" className="btn btn-primary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Choose This Split
          </Link>
        </div>

        {/* Push / Pull / Legs */}
        <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderColor: 'var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>5-6 Days / Week</span>
              <small style={{ color: 'var(--text-muted)' }}>Hypertrophy</small>
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-3)' }}>Hypertrophy PPL Split</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              Engineered for experienced lifters targeting targeted volume and muscle isolation. Separates pushing mechanics, pulling movements, and leg drive.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Clock size={14} /> 60-80 min per session
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Target size={14} /> Heavy Barbell Press, Rows, Bulgarian Split Squats
              </div>
            </div>
          </div>
          <Link to="/signup" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Choose This Split
          </Link>
        </div>
      </div>

      {/* Deep Dive Features */}
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 'var(--space-4)' }}>The Gym-First Workout Experience</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-8)' }}>
          We designed the active workout tracker specifically for one-handed operation on the gym floor between heavy sets.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', textAlign: 'left' }}>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <Zap size={20} color="var(--accent-primary)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Automatic Weight Steppers</div>
            <small style={{ color: 'var(--text-muted)' }}>Increment by +2.5kg or +5kg with single taps. No tedious typing.</small>
          </div>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <Clock size={20} color="var(--accent-primary)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Web Audio Rest Timer</div>
            <small style={{ color: 'var(--text-muted)' }}>Audible two-tone chime when your rest interval concludes.</small>
          </div>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <Target size={20} color="var(--accent-primary)" style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Previous Performance</div>
            <small style={{ color: 'var(--text-muted)' }}>Instantly view what you lifted last session for every exercise.</small>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-8)' }}>
          <Link to="/signup" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Build Your Training Plan <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};
