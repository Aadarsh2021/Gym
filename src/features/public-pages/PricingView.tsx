import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Zap, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { PRODUCT_NAME } from '@/config/branding';
import { SEOHead } from '@/components/common/SEOHead';

export const PricingView: React.FC = () => {
  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) var(--space-12)' }}>
      <SEOHead
        title={`Membership Tiers & Feature Comparison | ${PRODUCT_NAME}`}
        description={`Compare ${PRODUCT_NAME} Free and Premium features: workout tracker, personalized routines, nutrition generator, exercise alternatives, and PR analytics.`}
        canonicalPath="/pricing"
      />

      {/* Header */}
      <div style={{ maxWidth: '760px', margin: '0 auto var(--space-10)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <span className="badge badge-accent">Tier Architecture</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Phase 1 Product Scope</span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 'var(--space-3)' }}>
          Transparent Access. Built for Real Progress.
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Start training with our full-featured Free tier, or elevate your routine with Premium performance analytics and nutrition intelligence.
        </p>
      </div>

      {/* Tiers Comparison Grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-8)',
          maxWidth: '960px',
          margin: '0 auto var(--space-12)',
          alignItems: 'stretch',
        }}
      >
        {/* Tier 1: Free */}
        <div
          className="card"
          style={{
            padding: 'var(--space-8) var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-card)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <span className="badge" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free Tier</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Phase 1 Active</span>
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Free Athlete</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-6)', minHeight: '40px' }}>
              Everything essential to structure your gym sessions, track sets, log Indian foods, and hit personal records.
            </p>

            <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  ₹0
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/ forever</span>
              </div>
              <small style={{ color: 'var(--color-success)', fontWeight: 600 }}>Zero payment info required</small>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                Included Free Features:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  'Personalized Workout Routine (Split generation)',
                  'Smart Exercise Finder & Biomechanical Library',
                  'Start & Track Workout (Sets, reps, weights, rest timers)',
                  'Full Workout History & Session Logs',
                  'Authoritative PR Tracking (Epley estimated 1RM)',
                  'Basic Progress Tracking & Bodyweight Log',
                  'Calorie & Protein Target Calculations',
                  'Personalized Meal Plan (Preference-based & adaptive)',
                  'Basic Protein & Full Nutritional Breakdown',
                  'Workout Alarm, Smart Repeat & Countdown',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <Check size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link to="/signup" className="btn btn-secondary btn-block" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Get Started Free
          </Link>
        </div>

        {/* Tier 2: Premium */}
        <div
          className="card card-elevated"
          style={{
            padding: 'var(--space-8) var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: 'var(--accent-primary)',
            background: 'var(--bg-surface-elevated)',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <span className="badge badge-accent" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Sparkles size={12} style={{ marginRight: '4px' }} /> Premium Tier
              </span>
              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.08)' }}>
                Premium V1 — Open Early Access
              </span>
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Premium Athlete</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-6)', minHeight: '40px' }}>
              Advanced biomechanical alternatives, multi-attribute meal generator, and live target comparison.
            </p>

            <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  Included
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>in Phase 1 Launch</span>
              </div>
              <small style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                Open Early Access • No billing required during Phase 1
              </small>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                Everything in Free, plus Premium V1:
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  'Exercise & Equipment Alternatives (Biomechanically matched)',
                  'Budget-Based Meal Planning (INR cost analysis & grocery optimization)',
                  'Multi-Attribute Meal Generator (Slot, macro, & serving calibrated)',
                  'Daily Nutrient Target vs Consumed Comparison (Live telemetry)',
                  'Mixed Meal Analysis & Custom Recipe Calculations',
                  'Meal Replacement Alternatives (Flexible substitution)',
                  '7-Day Rotating Meal Schedule',
                  'High-Resolution Strength & Volume Progress Curves',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <Zap size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <span style={{ fontWeight: 500 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link to="/signup" className="btn btn-primary btn-block btn-lg" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Start Training Now <ArrowRight size={16} style={{ marginLeft: '6px' }} />
          </Link>
        </div>
      </div>

      {/* Phase 2 Preview Section (Honest Disclosure) */}
      <div
        className="card"
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: 'var(--space-6)',
          borderColor: 'var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <Clock size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Roadmap Disclosure
          </span>
        </div>
        <h4 style={{ margin: '0 0 var(--space-2)', fontSize: '1.1rem' }}>Planned for Phase 2 (V2)</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
          The following capability is reserved for Phase 2 and is not active in Phase 1: <strong>Guru Ji Real-Time AI Coaching</strong> — personalized AI-driven training and nutrition guidance. All Phase 1 training, nutrition, exercise substitution, and tracking features (including 7-day meal scheduling) are fully accessible without subscription paywalls today.
        </p>
      </div>
    </div>
  );
};
