import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dumbbell,
  BookOpen,
  Utensils,
  ArrowRight,
} from 'lucide-react';

export const PublicHomeView: React.FC = () => {
  return (
    <div className="animate-fade-in" style={{ paddingBottom: 'var(--space-12)' }}>
      {/* HERO SECTION */}
      <section
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-12) var(--space-4) var(--space-12)',
          background: 'radial-gradient(ellipse at 50% -20%, rgba(224, 139, 76, 0.07), transparent 70%)',
        }}
      >
        <div className="container" style={{ textAlign: 'center', maxWidth: '840px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <span className="badge badge-accent">Performance Training</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Engineered for Dedicated Lifters</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.4rem, 5.5vw, 4rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              marginBottom: 'var(--space-4)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
            }}
          >
            Train smarter.{' '}
            <span style={{ color: 'var(--accent-primary)' }}>Build real strength.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: 'var(--space-8)',
              maxWidth: '720px',
              margin: '0 auto var(--space-8)',
            }}
          >
            Personalized split design, gym-first workout tracking, Indian-focused nutrition targets,
            and verified personal records built for lifters who take progress seriously.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-10)',
            }}
          >
            <Link
              to="/signup"
              className="btn btn-primary btn-lg"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: 'var(--space-3) var(--space-8)',
                fontSize: '1.05rem',
              }}
            >
              Get Started <ArrowRight size={18} />
            </Link>
            <Link
              to="/exercises"
              className="btn btn-secondary btn-lg"
              style={{
                textDecoration: 'none',
                padding: 'var(--space-3) var(--space-6)',
                fontSize: '1.05rem',
              }}
            >
              Explore Exercise Library
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>32+</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Curated Movements</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>100%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progressive Overload</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>1.6-2.2g</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Protein Scaling / kg</div>
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Distractions or Fluff</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (Profile -> Plan -> Train -> Progress) */}
      <section style={{ padding: 'var(--space-12) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>The Methodology</span>
            <h2>How It Works</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Four structured pillars that transform gym effort into repeatable, measurable strength gains.
            </p>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            {/* Step 1: Profile */}
            <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>01 • Profile</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Your Biometrics & Schedule</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Input your training frequency (3 to 6 days), experience level, and available gym equipment. No generic one-size-fits-all routines.
              </p>
            </div>

            {/* Step 2: Plan */}
            <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>02 • Plan</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Tailored Split Structure</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Structured Push/Pull/Legs, Upper/Lower, or Full Body splits with prescribed sets, rep windows, and calibrated recovery days.
              </p>
            </div>

            {/* Step 3: Train */}
            <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>03 • Train</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Gym-Floor Tracker</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Log weight, reps, and RPE with tactile steppers, instant past-session benchmarks, and built-in audio rest intervals.
              </p>
            </div>

            {/* Step 4: Progress */}
            <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>04 • Progress</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Verified Strength Gains</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Every personal record is calculated and verified directly from completed sets. Track 1RM estimations and consistency streaks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES SHOWCASE WITH ASYMMETRICAL RHYTHM */}
      <section style={{ padding: 'var(--space-12) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>The Training System</span>
            <h2>Built for Serious Lifters</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '620px' }}>
              Everything you need to progress week-over-week without distraction or gimmicks.
            </p>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Feature 1: Featured Dominant Card - Active Gym Tracker */}
            <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-medium)', background: 'var(--bg-surface-elevated)', gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: '10px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                  <Dumbbell size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Gym-First Tracker</h3>
                  <small style={{ color: 'var(--text-muted)' }}>High-contrast instrument ergonomics</small>
                </div>
              </div>

              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                Large weight steppers, automatic previous-session history, RPE exertion logging, and built-in audio rest intervals designed for one-handed operation on the gym floor.
              </p>

              {/* Instrument Dial Preview */}
              <div
                style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  padding: 'var(--space-3) var(--space-4)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>BARBELL BENCH PRESS</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>80.0 KG</strong>
                  <span style={{ color: 'var(--text-muted)' }}> × 8 reps</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-accent" style={{ fontFamily: 'var(--font-mono)' }}>REST 01:30</span>
                </div>
              </div>

              <Link to="/workouts" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Explore training splits <ArrowRight size={14} />
              </Link>
            </div>

            {/* Feature 2 & 3: Secondary Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Exercise Library */}
              <div className="card card-interactive" style={{ padding: 'var(--space-5)', borderColor: 'var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ padding: '8px', background: 'var(--accent-indigo-muted)', borderRadius: 'var(--radius-md)', color: '#8FA8C7' }}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Exercise Library</h3>
                    <small style={{ color: 'var(--text-muted)' }}>32+ Curated Reference Movements</small>
                  </div>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-3)' }}>
                  Movement patterns, target muscle maps, technique coaching cues, mistakes to avoid, and intelligent gym equipment alternatives.
                </p>
                <Link to="/exercises" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Explore exercise catalog <ArrowRight size={14} />
                </Link>
              </div>

              {/* Indian Nutrition */}
              <div className="card card-interactive" style={{ padding: 'var(--space-5)', borderColor: 'var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ padding: '8px', background: 'rgba(127, 166, 107, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)' }}>
                    <Utensils size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Indian Nutrition Science</h3>
                    <small style={{ color: 'var(--text-muted)' }}>Indian Food Composition References</small>
                  </div>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-3)' }}>
                  Accurate macro breakdowns tailored for Indian diets. High-protein vegetarian solutions (paneer, soya chunks, moong dal) and non-veg protein targets.
                </p>
                <Link to="/nutrition" style={{ color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Explore nutrition guidelines <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FREE PUBLIC CALCULATORS TEASER */}
      <section style={{ padding: 'var(--space-12) var(--space-4)' }}>
        <div className="container">
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              padding: 'var(--space-8) var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>Instant Tools</span>
                <h3 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Free Science-Based Calculators</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '540px' }}>
                  Use our clinical-formula calculators without signing in. Determine your BMR, maintenance calories, protein requirements, and 1RM.
                </p>
              </div>
              <Link to="/tools" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                Open All Calculators →
              </Link>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              <Link
                to="/tools/bmr"
                className="card card-interactive"
                style={{ textDecoration: 'none', padding: 'var(--space-4)' }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>BMR Calculator</div>
                <small style={{ color: 'var(--text-muted)' }}>Mifflin-St Jeor basal metabolic rate</small>
              </Link>
              <Link
                to="/tools/tdee"
                className="card card-interactive"
                style={{ textDecoration: 'none', padding: 'var(--space-4)' }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>TDEE Calculator</div>
                <small style={{ color: 'var(--text-muted)' }}>Activity-adjusted daily energy expenditure</small>
              </Link>
              <Link
                to="/tools/protein"
                className="card card-interactive"
                style={{ textDecoration: 'none', padding: 'var(--space-4)' }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Daily Protein Target</div>
                <small style={{ color: 'var(--text-muted)' }}>1.6-2.2g/kg athletic protein scaling</small>
              </Link>
              <Link
                to="/tools/one-rep-max"
                className="card card-interactive"
                style={{ textDecoration: 'none', padding: 'var(--space-4)' }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>1-Rep Max Estimator</div>
                <small style={{ color: 'var(--text-muted)' }}>Brzycki authoritative 1RM formula</small>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2>Ready to upgrade your training?</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            Start with your custom profile, build your science-backed training plan, and log your next workout.
          </p>
          <Link
            to="/signup"
            className="btn btn-primary btn-lg"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Create Your Plan Now <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
};
