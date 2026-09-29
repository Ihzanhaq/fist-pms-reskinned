// Claude-style starburst mark, drawn in currentColor to match the other nav icons.
const RAYS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const LONG = new Set([0, 60, 120, 180, 240, 300]);

export default function ClaudeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {RAYS.map((angle) => (
        <line
          key={angle}
          x1="12"
          y1="12"
          x2="12"
          y2={LONG.has(angle) ? 2 : 4.5}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}
