import React from 'react';

interface FooterProps {
  onOpenPublicTool?: (tool: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPublicTool }) => {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      padding: 'var(--space-8) var(--space-4) calc(var(--bottom-nav-height) + var(--space-8))',
      background: 'var(--bg-secondary)',
      marginTop: 'auto',
    }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
          {/* Brand Info */}
          <div>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>FITNESS.AI</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Consumer-first personal fitness system. Algorithmic workout generation, Indian-tailored nutrition plans, authoritative PR tracking, and Guru Ji AI assistance.
            </p>
          </div>

          {/* Public Fitness Calculators (SEO) */}
          <div>
            <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.95rem' }}>Free Public Calculators</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <button
                onClick={() => onOpenPublicTool?.('bmr-calculator')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                BMR & TDEE Calculator
              </button>
              <button
                onClick={() => onOpenPublicTool?.('protein-calculator')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                Daily Protein Target Calculator
              </button>
              <button
                onClick={() => onOpenPublicTool?.('1rm-calculator')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                1-Rep Max (1RM) Estimator
              </button>
            </div>
          </div>

          {/* Nutrition Reference & Guides */}
          <div>
            <h4 style={{ marginBottom: 'var(--space-2)', fontSize: '0.95rem' }}>Nutrition Knowledge</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ICMR-NIN Indian Food Reference Composition
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Vegetarian High-Protein Sources: Paneer, Soya Chunks, Moong Dal
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 'var(--space-4)',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          <strong>Important Health Disclaimer:</strong> All calorie, macro, workout, and nutritional estimates are reference approximations and do not constitute clinical or medical prescriptions. Consult a physician before beginning any strenuous workout routine or dietary changes.
        </div>
      </div>
    </footer>
  );
};
