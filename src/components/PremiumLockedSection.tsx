import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';

interface PremiumLockedSectionProps {
  featureName: string;
  featureDescription: string;
  ctaText?: string;
  compact?: boolean;
}

export const PremiumLockedSection: React.FC<PremiumLockedSectionProps> = ({
  featureName,
  featureDescription,
  ctaText = 'Upgrade to Premium',
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              padding: '8px',
              background: 'rgba(234, 179, 8, 0.12)',
              color: '#eab308',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Lock size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '0.92rem' }}>{featureName}</strong>
              <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                PREMIUM
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {featureDescription}
            </p>
          </div>
        </div>

        <Link
          to="/pricing"
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <span>{ctaText}</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="card card-elevated animate-fade-in"
      style={{
        padding: 'var(--space-8) var(--space-6)',
        textAlign: 'center',
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-medium)',
        maxWidth: '560px',
        margin: 'var(--space-6) auto',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(234, 179, 8, 0.14)',
          color: '#eab308',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
        }}
      >
        <Lock size={26} />
      </div>

      <span
        className="badge badge-secondary"
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
          marginBottom: 'var(--space-2)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Sparkles size={12} /> PREMIUM V1 CAPABILITY
      </span>

      <h3 style={{ fontSize: '1.4rem', margin: 'var(--space-1) 0 var(--space-2)' }}>
        {featureName}
      </h3>

      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.94rem',
          lineHeight: 1.6,
          maxWidth: '440px',
          margin: '0 auto var(--space-6)',
        }}
      >
        {featureDescription}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
        <Link
          to="/pricing"
          className="btn btn-primary btn-lg"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span>{ctaText}</span>
          <ArrowRight size={18} />
        </Link>
        <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Available with FitBoost Pro & Premium plans.
        </small>
      </div>
    </div>
  );
};
