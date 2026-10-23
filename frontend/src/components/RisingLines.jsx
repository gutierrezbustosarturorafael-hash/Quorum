import React from 'react';

const RisingLines = ({ className = '' }) => (
  <div className={`rising-lines ${className}`} aria-hidden="true">
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="rising-line-stroke" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.03" />
          <stop offset="65%" stopColor="var(--accent)" stopOpacity="0.48" />
          <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="rising-line-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="760" cy="190" rx="520" ry="150" fill="url(#rising-line-glow)" />
      {Array.from({ length: 15 }, (_, index) => {
        const offset = index * 86;
        return (
          <path
            key={index}
            className="rising-line-path"
            d={`M ${-120 + offset} 340 C ${40 + offset} 250, ${-70 + offset} 155, ${180 + offset} -30`}
            pathLength="1"
            style={{ '--line-index': index }}
            stroke="url(#rising-line-stroke)"
            fill="none"
          />
        );
      })}
      <path className="rising-line-beam" d="M 60 300 C 360 220, 650 220, 1120 20" fill="none" />
      {Array.from({ length: 12 }, (_, index) => (
        <circle
          key={index}
          className="rising-line-particle"
          cx={90 + ((index * 97) % 1050)}
          cy={45 + ((index * 41) % 230)}
          r={2 + (index % 3)}
          style={{ '--particle-index': index }}
        />
      ))}
    </svg>
  </div>
);

export default RisingLines;
