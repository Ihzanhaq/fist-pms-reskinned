import { useCallback, useEffect, useState } from 'react';

// Appearance settings: which theme, and how the liquid glass theme looks.
// Saved per browser. The resolved result is also saved separately so the
// inline script in index.html can apply it before the first paint.

export const THEMES = [
  { id: 'light', name: 'Light', mode: 'light', note: 'Bright and clean', preview: { bg: '#f3f6f5', sidebar: '#0f6b61', surface: '#ffffff', accent: '#059669', line: '#e5ebe9' } },
  { id: 'dark', name: 'Dark', mode: 'dark', note: 'Near-black, easy on the eyes', preview: { bg: '#09090d', sidebar: '#101016', surface: '#16161d', accent: '#34d399', line: '#24242c' } },
  { id: 'lavender', name: 'Lavender', mode: 'light', note: 'The original violet look', preview: { bg: '#f4f3f9', sidebar: '#9187cf', surface: '#ffffff', accent: '#8b6fe8', line: '#ebeaf2' } },
  { id: 'navy', name: 'Navy', mode: 'dark', note: 'Deep blue with a sky accent', preview: { bg: '#070e1d', sidebar: '#0b1631', surface: '#111d38', accent: '#60a5fa', line: '#1b2947' } },
  { id: 'glass', name: 'Liquid glass', mode: null, note: 'Frosted panels over your background', preview: null },
];

// Wallpaper-style gradients for the glass theme. `tint` is the glass that reads best on it.
export const GLASS_PRESETS = [
  {
    id: 'sonoma',
    name: 'Sonoma',
    tint: 'light',
    css: 'radial-gradient(at 18% 22%, #ffb199 0, transparent 52%), radial-gradient(at 82% 8%, #ff7aa2 0, transparent 50%), radial-gradient(at 78% 82%, #7f8cff 0, transparent 55%), radial-gradient(at 6% 96%, #ffcf8a 0, transparent 50%), #c9a6d9',
  },
  {
    id: 'mist',
    name: 'Mist',
    tint: 'light',
    css: 'radial-gradient(at 12% 18%, #ffffff 0, transparent 55%), radial-gradient(at 88% 12%, #d6e4f5 0, transparent 50%), radial-gradient(at 70% 90%, #e9dccb 0, transparent 55%), linear-gradient(160deg, #dfe6ee, #cfd8e2)',
  },
  {
    id: 'meadow',
    name: 'Meadow',
    tint: 'light',
    css: 'radial-gradient(at 0% 0%, #e2fca0 0, transparent 50%), radial-gradient(at 100% 20%, #9be7b9 0, transparent 52%), radial-gradient(at 55% 100%, #4cc9a4 0, transparent 58%), #8fd3b2',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    tint: 'dark',
    css: 'radial-gradient(at 20% 15%, #1fd1a5 0, transparent 45%), radial-gradient(at 80% 25%, #4f46e5 0, transparent 50%), radial-gradient(at 50% 95%, #0ea5e9 0, transparent 55%), #081421',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tint: 'dark',
    css: 'radial-gradient(at 10% 10%, #4facfe 0, transparent 50%), radial-gradient(at 90% 35%, #00c6fb 0, transparent 45%), radial-gradient(at 45% 100%, #1e3c72 0, transparent 60%), #0b1a2e',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    tint: 'dark',
    css: 'radial-gradient(at 85% 90%, #f08a6c 0, transparent 50%), radial-gradient(at 15% 80%, #c06c84 0, transparent 52%), radial-gradient(at 50% 0%, #4c3a6b 0, transparent 60%), #1f1830',
  },
];

const KEY = 'pms-dashboard:appearance';
const APPLIED_KEY = 'pms-dashboard:appearance-applied';
const LEGACY_KEY = 'pms-dashboard:theme';

export const DEFAULT_DISPLAY = {
  projectCovers: true,
  projectEmojis: true,
};

export const DEFAULT_GLASS = {
  background: { type: 'preset', preset: 'sonoma', from: '#7f8cff', to: '#ff9a8b', angle: 135, image: null },
  tint: 'light',
  blur: 22,
  bgBlur: 0, // px of blur on the wallpaper itself
  dim: 0, // 0–70 % darken (dark glass) or lighten (light glass)
};

const systemMode = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved) {
      return {
        theme: saved.theme ?? null,
        glass: { ...DEFAULT_GLASS, ...saved.glass, background: { ...DEFAULT_GLASS.background, ...saved.glass?.background } },
        display: { ...DEFAULT_DISPLAY, ...saved.display },
      };
    }
  } catch {
    /* fall through to defaults */
  }
  const legacy = localStorage.getItem(LEGACY_KEY); // the old light/dark toggle
  return { theme: legacy === 'light' || legacy === 'dark' ? legacy : null, glass: DEFAULT_GLASS, display: DEFAULT_DISPLAY };
}

export function glassBackgroundCss(background) {
  if (background.type === 'image' && background.image) return `center / cover no-repeat url("${background.image}"), #1b1d24`;
  if (background.type === 'gradient') return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
  return (GLASS_PRESETS.find((p) => p.id === background.preset) ?? GLASS_PRESETS[0]).css;
}

// What is actually shown: theme id, light/dark mode and glass variables.
export function resolve(settings) {
  const id = settings.theme ?? systemMode();
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
  if (theme.id !== 'glass') return { theme: theme.id, mode: theme.mode };
  return {
    theme: 'glass',
    mode: settings.glass.tint,
    bg: glassBackgroundCss(settings.glass.background),
    blur: settings.glass.blur,
    bgBlur: settings.glass.bgBlur ?? 0,
    dim: settings.glass.dim ?? 0,
  };
}

let lastLook = null;

// Cross-fade the whole page when the theme, mode or background changes.
// Slider tweaks (blur, dim) apply instantly so dragging stays responsive.
function apply(resolved) {
  const look = `${resolved.theme}|${resolved.mode}|${resolved.bg ?? ''}`;
  const fade =
    lastLook !== null &&
    look !== lastLook &&
    document.startViewTransition &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  lastLook = look;
  if (fade) document.startViewTransition(() => setLook(resolved));
  else setLook(resolved);
}

function setLook(resolved) {
  const root = document.documentElement;
  root.dataset.theme = resolved.theme;
  root.dataset.mode = resolved.mode;
  if (resolved.bg) {
    root.style.setProperty('--glass-bg', resolved.bg);
    root.style.setProperty('--glass-blur', `${resolved.blur}px`);
    root.style.setProperty('--glass-bg-blur', `${resolved.bgBlur}px`);
    root.style.setProperty('--glass-dim', String(resolved.dim / 100));
  } else {
    root.style.removeProperty('--glass-bg');
    root.style.removeProperty('--glass-blur');
    root.style.removeProperty('--glass-bg-blur');
    root.style.removeProperty('--glass-dim');
  }
}

// Downscale an uploaded photo so it fits comfortably in browser storage, and
// measure its brightness from the same bitmap (no <img> decode, which browsers
// can postpone indefinitely in background tabs).
export async function prepareImage(file, maxSide = 2400) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const sample = document.createElement('canvas');
  sample.width = 24;
  sample.height = 24;
  const ctx = sample.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, 24, 24);
  bitmap.close?.();
  const { data } = ctx.getImageData(0, 0, 24, 24);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) total += luminance(data[i], data[i + 1], data[i + 2]);

  return { image: canvas.toDataURL('image/jpeg', 0.85), luminance: total / (data.length / 4) };
}

export function useAppearance() {
  const [settings, setSettings] = useState(load);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const resolved = resolve(settings);
    apply(resolved);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      localStorage.setItem(APPLIED_KEY, JSON.stringify(resolved));
      localStorage.removeItem(LEGACY_KEY);
      setSaveError(null);
    } catch {
      setSaveError('This image is too large to save in the browser. Try a smaller one.');
    }
  }, [settings]);

  // With no saved choice, follow the system light/dark setting live.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSettings((s) => (s.theme ? s : { ...s }));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);
  const updateGlass = useCallback(
    (patch) => setSettings((s) => ({ ...s, glass: { ...s.glass, ...patch, background: { ...s.glass.background, ...patch.background } } })),
    [],
  );
  const updateDisplay = useCallback(
    (patch) => setSettings((s) => ({ ...s, display: { ...DEFAULT_DISPLAY, ...s.display, ...patch } })),
    [],
  );

  return { settings, resolved: resolve(settings), update, updateGlass, updateDisplay, saveError };
}

// Brightness 0 (black) … 1 (white), used to pick light or dark glass for a background.
const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function hexLuminance(hex) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return luminance((n >> 16) & 255, (n >> 8) & 255, n & 255);
}


// Light glass reads best on bright backgrounds, dark glass on dark ones.
export const tintFor = (lum) => (lum > 0.4 ? 'light' : 'dark');
