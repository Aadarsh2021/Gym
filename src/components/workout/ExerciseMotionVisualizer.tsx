import React, { useState } from 'react';
import { Play, Pause, Zap } from 'lucide-react';

interface ExerciseMotionVisualizerProps {
  exerciseName: string;
  primaryMuscle: string;
  isCompact?: boolean;
}

export const ExerciseMotionVisualizer: React.FC<ExerciseMotionVisualizerProps> = ({
  exerciseName,
  primaryMuscle,
  isCompact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);

  // Normalize exercise to find movement archetype
  const nameLower = exerciseName.toLowerCase();

  const getMovementType = (): 'calf' | 'pushup' | 'pulldown' | 'squat' | 'plank' | 'curl' | 'press' | 'generic' => {
    if (nameLower.includes('calf')) return 'calf';
    if (nameLower.includes('push-up') || nameLower.includes('pushup') || nameLower.includes('bench')) return 'pushup';
    if (nameLower.includes('pulldown') || nameLower.includes('pull-up') || nameLower.includes('row')) return 'pulldown';
    if (nameLower.includes('squat') || nameLower.includes('lunge')) return 'squat';
    if (nameLower.includes('plank')) return 'plank';
    if (nameLower.includes('curl')) return 'curl';
    if (nameLower.includes('press') || nameLower.includes('raise')) return 'press';
    return 'generic';
  };

  const movementType = getMovementType();
  const height = isCompact ? '110px' : '175px';

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(16, 20, 26, 0.98) 0%, rgba(10, 13, 17, 1) 100%)',
        border: '1px solid var(--border-medium)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.6), 0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Background Tech Radar Grid & Concentric Rings */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(79, 142, 247, 0.08) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: isCompact ? '160px' : '260px',
          height: isCompact ? '160px' : '260px',
          borderRadius: '50%',
          border: '1px solid rgba(79, 142, 247, 0.1)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: isCompact ? '110px' : '180px',
          height: isCompact ? '110px' : '180px',
          borderRadius: '50%',
          border: '1px dashed rgba(79, 142, 247, 0.15)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Left: Muscle Target Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            background: 'rgba(79, 142, 247, 0.12)',
            padding: '2px 7px',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid rgba(79, 142, 247, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Zap size={10} />
          {primaryMuscle}
        </span>
      </div>

      {/* Top Right: Live Motion Status & Play/Pause */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: isPlaying ? 'var(--color-success)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isPlaying ? 'var(--color-success)' : 'var(--text-muted)',
              boxShadow: isPlaying ? '0 0 8px var(--color-success)' : 'none',
              display: 'inline-block',
            }}
          />
          {isPlaying ? 'Motion Loop' : 'Paused'}
        </span>

        <button
          type="button"
          onClick={() => setIsPlaying(prev => !prev)}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isPlaying ? 'Pause Motion' : 'Play Motion'}
        >
          {isPlaying ? <Pause size={10} /> : <Play size={10} />}
        </button>
      </div>

      {/* ANIMATED BIOMECHANICAL MOTION GRAPHICS */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {/* ================================================================= */}
        {/* 1. CALF RAISE ANIMATION */}
        {/* ================================================================= */}
        {movementType === 'calf' && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes calfPlantarFlexion {
                  0%, 100% { transform: translateY(0px); }
                  25% { transform: translateY(-16px); }
                  45% { transform: translateY(-16px); }
                  80% { transform: translateY(0px); }
                }
                @keyframes calfMuscleGlow {
                  0%, 100% { fill: rgba(79, 142, 247, 0.25); stroke-width: 1.5px; }
                  25%, 45% { fill: rgba(79, 142, 247, 0.85); stroke-width: 3px; filter: drop-shadow(0 0 8px #4f8ef7); }
                  80% { fill: rgba(79, 142, 247, 0.25); stroke-width: 1.5px; }
                }
                @keyframes stepPlatformPulse {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 1; }
                }
              `}
            </style>

            {/* Step / Block Platform */}
            <rect x="50" y="95" width="140" height="8" rx="2" fill="var(--border-medium)" />
            <line x1="50" y1="95" x2="190" y2="95" stroke="var(--border-strong)" strokeWidth="2" />

            {/* Animated Leg / Heel Structure */}
            <g
              style={{
                transformOrigin: '145px 95px',
                animation: isPlaying ? 'calfPlantarFlexion 2.6s ease-in-out infinite' : 'none',
              }}
            >
              {/* Shin Bone Line */}
              <line x1="120" y1="20" x2="120" y2="85" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />

              {/* Gastrocnemius & Soleus Calf Muscle Belly (Glows under contraction) */}
              <path
                d="M 120 30 Q 148 50 125 75 Q 118 80 120 85 Q 110 55 120 30 Z"
                fill="rgba(79, 142, 247, 0.3)"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                style={{
                  animation: isPlaying ? 'calfMuscleGlow 2.6s ease-in-out infinite' : 'none',
                }}
              />

              {/* Achilles Tendon */}
              <line x1="123" y1="75" x2="128" y2="92" stroke="#8da0b8" strokeWidth="3" strokeLinecap="round" />

              {/* Foot & Toes */}
              <path
                d="M 115 90 L 155 94 L 165 95 Q 160 92 145 88 Z"
                fill="var(--text-secondary)"
              />

              {/* Upward Force Vectors */}
              <path
                d="M 125 15 L 125 8 M 121 11 L 125 7 L 129 11"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Target Label */}
            <text x="120" y="114" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              GASTROCNEMIUS CONTRACTION
            </text>
          </svg>
        )}

        {/* ================================================================= */}
        {/* 2. PUSH-UP ANIMATION */}
        {/* ================================================================= */}
        {movementType === 'pushup' && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes pushupTorsoMovement {
                  0%, 100% { transform: translateY(0px); }
                  35% { transform: translateY(18px); }
                  50% { transform: translateY(18px); }
                  85% { transform: translateY(0px); }
                }
                @keyframes pushupPecGlow {
                  0%, 100% { fill: rgba(79, 142, 247, 0.3); }
                  35%, 50% { fill: rgba(79, 142, 247, 0.9); filter: drop-shadow(0 0 10px #4f8ef7); }
                  85% { fill: rgba(79, 142, 247, 0.3); }
                }
                @keyframes armBendMovement {
                  0%, 100% { d: path("M 80 50 L 80 85 L 80 95"); }
                  35%, 50% { d: path("M 80 68 L 60 76 L 80 95"); }
                  85% { d: path("M 80 50 L 80 85 L 80 95"); }
                }
              `}
            </style>

            {/* Ground Line */}
            <line x1="30" y1="95" x2="210" y2="95" stroke="var(--border-medium)" strokeWidth="2" />

            {/* Feet Anchor */}
            <circle cx="185" cy="93" r="4" fill="var(--text-muted)" />

            {/* Torso & Head (Lowers in Push-Up) */}
            <g
              style={{
                animation: isPlaying ? 'pushupTorsoMovement 2.8s ease-in-out infinite' : 'none',
              }}
            >
              {/* Head */}
              <circle cx="58" cy="46" r="8" fill="var(--text-secondary)" />

              {/* Chest / Torso Plank Line */}
              <line x1="70" y1="52" x2="185" y2="92" stroke="var(--text-secondary)" strokeWidth="7" strokeLinecap="round" />

              {/* Pectoralis Major Activation Badge */}
              <ellipse
                cx="88"
                cy="57"
                rx="14"
                ry="8"
                fill="rgba(79, 142, 247, 0.4)"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                style={{
                  animation: isPlaying ? 'pushupPecGlow 2.8s ease-in-out infinite' : 'none',
                }}
              />

              {/* Dynamic Arm with Elbow Flexion */}
              <path
                d="M 82 55 L 68 74 L 80 95"
                stroke="var(--accent-primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>

            {/* Target Label */}
            <text x="120" y="114" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              ECCENTRIC / CONCENTRIC DRIVE
            </text>
          </svg>
        )}

        {/* ================================================================= */}
        {/* 3. LAT PULLDOWN / PULL ANIMATION */}
        {/* ================================================================= */}
        {movementType === 'pulldown' && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes cableBarPull {
                  0%, 100% { transform: translateY(0px); }
                  30% { transform: translateY(22px); }
                  50% { transform: translateY(22px); }
                  85% { transform: translateY(0px); }
                }
                @keyframes latContractionGlow {
                  0%, 100% { fill: rgba(79, 142, 247, 0.25); }
                  30%, 50% { fill: rgba(79, 142, 247, 0.9); filter: drop-shadow(0 0 10px #4f8ef7); }
                  85% { fill: rgba(79, 142, 247, 0.25); }
                }
              `}
            </style>

            {/* Top Pulley Cable Station */}
            <rect x="112" y="10" width="16" height="6" rx="2" fill="var(--border-strong)" />
            <line x1="120" y1="16" x2="120" y2="40" stroke="var(--border-medium)" strokeWidth="2" strokeDasharray="3 3" />

            {/* Athlete Torso (Stationary) */}
            <circle cx="120" cy="55" r="9" fill="var(--text-secondary)" />
            <path d="M 120 64 L 120 100" stroke="var(--text-secondary)" strokeWidth="8" strokeLinecap="round" />

            {/* Latissimus Dorsi Muscle Flares */}
            <path
              d="M 120 68 Q 95 82 110 98 Q 120 95 120 85 Q 120 95 130 98 Q 145 82 120 68 Z"
              fill="rgba(79, 142, 247, 0.3)"
              stroke="var(--accent-primary)"
              strokeWidth="2"
              style={{
                animation: isPlaying ? 'latContractionGlow 2.8s ease-in-out infinite' : 'none',
              }}
            />

            {/* Animated Cable Bar & Forearms */}
            <g
              style={{
                animation: isPlaying ? 'cableBarPull 2.8s ease-in-out infinite' : 'none',
              }}
            >
              {/* Wide Lat Bar */}
              <path d="M 65 32 Q 120 28 175 32" stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round" fill="none" />
              {/* Hands & Arms Pulling */}
              <line x1="75" y1="33" x2="105" y2="68" stroke="var(--text-muted)" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="165" y1="33" x2="135" y2="68" stroke="var(--text-muted)" strokeWidth="3.5" strokeLinecap="round" />
            </g>

            {/* Target Label */}
            <text x="120" y="114" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              LATISSIMUS DORSI RETRACTION
            </text>
          </svg>
        )}

        {/* ================================================================= */}
        {/* 4. SQUAT / LEGS ANIMATION */}
        {/* ================================================================= */}
        {movementType === 'squat' && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes squatHipsDescent {
                  0%, 100% { transform: translateY(0px); }
                  35% { transform: translateY(20px); }
                  50% { transform: translateY(20px); }
                  85% { transform: translateY(0px); }
                }
                @keyframes quadGlow {
                  0%, 100% { fill: rgba(79, 142, 247, 0.25); }
                  35%, 50% { fill: rgba(79, 142, 247, 0.9); filter: drop-shadow(0 0 10px #4f8ef7); }
                  85% { fill: rgba(79, 142, 247, 0.25); }
                }
              `}
            </style>

            {/* Floor */}
            <line x1="50" y1="95" x2="190" y2="95" stroke="var(--border-medium)" strokeWidth="2" />

            {/* Feet Fixed */}
            <ellipse cx="98" cy="94" rx="8" ry="3" fill="var(--text-muted)" />
            <ellipse cx="142" cy="94" rx="8" ry="3" fill="var(--text-muted)" />

            {/* Upper Body & Hips Lowering */}
            <g
              style={{
                animation: isPlaying ? 'squatHipsDescent 2.8s ease-in-out infinite' : 'none',
              }}
            >
              {/* Head & Barbell */}
              <circle cx="120" cy="28" r="8" fill="var(--text-secondary)" />
              <line x1="80" y1="34" x2="160" y2="34" stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round" />
              <rect x="76" y="29" width="6" height="10" rx="1" fill="#4f8ef7" />
              <rect x="158" y="29" width="6" height="10" rx="1" fill="#4f8ef7" />

              {/* Spine Line */}
              <line x1="120" y1="36" x2="120" y2="58" stroke="var(--text-secondary)" strokeWidth="6" strokeLinecap="round" />

              {/* Femur & Thigh Quadriceps Glow */}
              <path
                d="M 120 58 Q 102 70 98 94"
                stroke="var(--accent-primary)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 120 58 Q 138 70 142 94"
                stroke="var(--accent-primary)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Target Label */}
            <text x="120" y="114" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              QUADRICEPS & GLUTE DRIVE
            </text>
          </svg>
        )}

        {/* ================================================================= */}
        {/* 5. PLANK / ISOMETRIC CORE ANIMATION */}
        {/* ================================================================= */}
        {movementType === 'plank' && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes corePulseTension {
                  0%, 100% { filter: drop-shadow(0 0 4px rgba(79, 142, 247, 0.4)); stroke-width: 6px; }
                  50% { filter: drop-shadow(0 0 12px rgba(79, 142, 247, 0.95)); stroke-width: 8px; }
                }
              `}
            </style>

            {/* Floor */}
            <line x1="40" y1="92" x2="200" y2="92" stroke="var(--border-medium)" strokeWidth="2" />

            {/* Forearm & Elbow Base */}
            <line x1="65" y1="92" x2="80" y2="92" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" />
            <line x1="72" y1="92" x2="72" y2="68" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" />

            {/* Head */}
            <circle cx="58" cy="62" r="7" fill="var(--text-secondary)" />

            {/* Feet */}
            <circle cx="178" cy="90" r="4" fill="var(--text-muted)" />

            {/* Perfectly Aligned Rigid Plank Spine Line */}
            <line
              x1="72"
              y1="68"
              x2="178"
              y2="88"
              stroke="var(--accent-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              style={{
                animation: isPlaying ? 'corePulseTension 2s ease-in-out infinite' : 'none',
              }}
            />

            {/* Core Tension Center Ring */}
            <circle cx="120" cy="77" r="9" fill="rgba(79, 142, 247, 0.3)" stroke="var(--accent-primary)" strokeWidth="2" />

            {/* Target Label */}
            <text x="120" y="112" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              ISOMETRIC CORE STABILIZATION
            </text>
          </svg>
        )}

        {/* ================================================================= */}
        {/* 6. GENERIC / ARM / PRESS ANIMATION */}
        {/* ================================================================= */}
        {(movementType === 'generic' || movementType === 'curl' || movementType === 'press') && (
          <svg
            viewBox="0 0 240 120"
            style={{
              width: isCompact ? '180px' : '220px',
              height: isCompact ? '90px' : '110px',
              overflow: 'visible',
            }}
          >
            <style>
              {`
                @keyframes barbellLiftArc {
                  0%, 100% { transform: translateY(12px); }
                  40% { transform: translateY(-16px); }
                  55% { transform: translateY(-16px); }
                  85% { transform: translateY(12px); }
                }
                @keyframes muscleGlowGeneric {
                  0%, 100% { fill: rgba(79, 142, 247, 0.3); }
                  40%, 55% { fill: rgba(79, 142, 247, 0.95); filter: drop-shadow(0 0 10px #4f8ef7); }
                  85% { fill: rgba(79, 142, 247, 0.3); }
                }
              `}
            </style>

            {/* Torso & Head */}
            <circle cx="120" cy="45" r="9" fill="var(--text-secondary)" />
            <line x1="120" y1="54" x2="120" y2="92" stroke="var(--text-secondary)" strokeWidth="8" strokeLinecap="round" />

            {/* Target Muscle Flare */}
            <circle
              cx="120"
              cy="65"
              r="14"
              fill="rgba(79, 142, 247, 0.3)"
              stroke="var(--accent-primary)"
              strokeWidth="2"
              style={{
                animation: isPlaying ? 'muscleGlowGeneric 2.6s ease-in-out infinite' : 'none',
              }}
            />

            {/* Lifting Barbell & Arms */}
            <g
              style={{
                animation: isPlaying ? 'barbellLiftArc 2.6s ease-in-out infinite' : 'none',
              }}
            >
              <line x1="75" y1="42" x2="165" y2="42" stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round" />
              <rect x="70" y="36" width="6" height="12" rx="1" fill="#4f8ef7" />
              <rect x="164" y="36" width="6" height="12" rx="1" fill="#4f8ef7" />

              {/* Arms Connecting to Bar */}
              <line x1="108" y1="58" x2="95" y2="42" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
              <line x1="132" y1="58" x2="145" y2="42" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Target Label */}
            <text x="120" y="114" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700" letterSpacing="0.05em">
              MECHANICAL LOAD CADENCE
            </text>
          </svg>
        )}
      </div>

      {/* Bottom Subtle Cadence Track Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--accent-primary)',
            width: isPlaying ? '100%' : '50%',
            transition: 'width 2.8s ease-in-out',
          }}
        />
      </div>
    </div>
  );
};
