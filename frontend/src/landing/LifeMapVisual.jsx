import { useReducedMotion } from './hooks/useReducedMotion';

const DOMAINS = [
  { label: 'HEALTH', x: 50, y: 12, angle: 0 },
  { label: 'FINANCE', x: 88, y: 28, angle: 45 },
  { label: 'GOALS', x: 92, y: 62, angle: 90 },
  { label: 'DOCUMENTS', x: 72, y: 88, angle: 135 },
  { label: 'CAREER', x: 28, y: 88, angle: 180 },
  { label: 'SECURITY', x: 8, y: 62, angle: 225 },
  { label: 'LEARNING', x: 12, y: 28, angle: 270 },
];

export default function LifeMapVisual({ className = '' }) {
  const reduced = useReducedMotion();

  return (
    <div className={`life-map-container ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.15" fill="#1E201E" opacity="0.06" />
          </pattern>
        </defs>

        <rect width="100" height="100" fill="url(#grid)" />

        {/* Timeline arcs */}
        <ellipse
          cx="50" cy="50" rx="38" ry="38"
          fill="none" stroke="#1E201E" strokeWidth="0.15" opacity="0.12"
          className={reduced ? '' : 'life-map-orbit'}
        />
        <ellipse
          cx="50" cy="50" rx="28" ry="28"
          fill="none" stroke="#375534" strokeWidth="0.12" opacity="0.15"
          className={reduced ? '' : 'life-map-orbit-reverse'}
        />
        <ellipse
          cx="50" cy="50" rx="18" ry="18"
          fill="none" stroke="#1E201E" strokeWidth="0.1" opacity="0.1"
          strokeDasharray="1 2"
        />

        {/* Connection lines from center to domains */}
        {DOMAINS.map((d, i) => (
          <line
            key={`line-${d.label}`}
            x1="50" y1="50"
            x2={d.x} y2={d.y}
            stroke="#375534"
            strokeWidth="0.12"
            opacity="0.2"
            className={reduced ? '' : 'life-map-line'}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}

        {/* Cross connections */}
        <path
          d="M 12 28 Q 50 40 88 28"
          fill="none" stroke="#1E201E" strokeWidth="0.08" opacity="0.08"
          className={reduced ? '' : 'life-map-flow'}
        />
        <path
          d="M 8 62 Q 50 55 92 62"
          fill="none" stroke="#1E201E" strokeWidth="0.08" opacity="0.08"
          className={reduced ? '' : 'life-map-flow'}
          style={{ animationDelay: '2s' }}
        />
        <path
          d="M 28 88 Q 50 70 72 88"
          fill="none" stroke="#375534" strokeWidth="0.08" opacity="0.1"
          className={reduced ? '' : 'life-map-flow'}
          style={{ animationDelay: '4s' }}
        />

        {/* Data points along paths */}
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const r = 22 + (i % 3) * 6;
          const cx = 50 + Math.cos(angle) * r;
          const cy = 50 + Math.sin(angle) * r;
          return (
            <circle
              key={`dot-${i}`}
              cx={cx} cy={cy} r="0.3"
              fill="#375534"
              opacity="0.25"
              className={reduced ? '' : 'life-map-pulse'}
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          );
        })}

        {/* Domain nodes */}
        {DOMAINS.map((d, i) => (
          <g key={d.label}>
            <circle
              cx={d.x} cy={d.y} r="1.8"
              fill="#FBFBF9"
              stroke="#1E201E"
              strokeWidth="0.2"
              opacity="0.9"
            />
            <circle
              cx={d.x} cy={d.y} r="0.5"
              fill="#375534"
              className={reduced ? '' : 'life-map-pulse'}
              style={{ animationDelay: `${i * 0.5 + 1}s` }}
            />
            <text
              x={d.x}
              y={d.y - 3.2}
              textAnchor="middle"
              fill="#1E201E"
              fontSize="2"
              fontFamily="DM Sans, sans-serif"
              fontWeight="600"
              letterSpacing="0.15"
              opacity="0.45"
            >
              {d.label}
            </text>
          </g>
        ))}

        {/* Central EVA node */}
        <circle cx="50" cy="50" r="4" fill="#FBFBF9" stroke="#1E201E" strokeWidth="0.25" />
        <circle cx="50" cy="50" r="2.5" fill="#375534" opacity="0.15" />
        <text
          x="50" y="51"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1E201E"
          fontSize="2.8"
          fontFamily="Fraunces, serif"
          fontWeight="900"
          opacity="0.7"
        >
          EVA
        </text>
      </svg>
    </div>
  );
}
