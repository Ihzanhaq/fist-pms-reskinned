// Claude mark from Simple Icons (CC0), assets/claude.svg. Filled with
// currentColor so it matches the other sidebar icons.
import svg from '../assets/claude.svg?raw';

const PATH = svg.match(/\sd="([^"]+)"/)[1];

export default function ClaudeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PATH} />
    </svg>
  );
}
