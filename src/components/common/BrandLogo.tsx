import React from 'react';
import { Activity } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/branding';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showGlyph?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * BrandLogo — Centralized, swappable product logo and wordmark.
 * Uses BRAND_CONFIG for temporary brand-agnostic display.
 * When the permanent brand identity and logo are finalized,
 * this component and BRAND_CONFIG are the single points of update.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showGlyph = true,
  className = '',
  style = {},
}) => {
  const glyphDimensions = size === 'sm' ? 26 : size === 'lg' ? 40 : 32;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const fontSize = size === 'sm' ? '1rem' : size === 'lg' ? '1.5rem' : '1.25rem';

  return (
    <div
      className={`brand-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        textDecoration: 'none',
        ...style,
      }}
    >
      {showGlyph && (
        <div
          style={{
            width: glyphDimensions,
            height: glyphDimensions,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0F1012',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Activity size={iconSize} strokeWidth={2.5} />
        </div>
      )}
      <span
        style={{
          fontFamily: 'var(--font-display, var(--font-heading))',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #FFFFFF 60%, #94A3B8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}
      >
        {BRAND_CONFIG.name}
      </span>
    </div>
  );
};
