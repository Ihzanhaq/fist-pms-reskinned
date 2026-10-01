import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Monitor, Trash2 } from 'lucide-react';
import UpdatesCard from './UpdatesCard.jsx';
import { GLASS_PRESETS, THEMES, glassBackgroundCss, hexLuminance, prepareImage, tintFor } from '../theme.js';

const MAX_UPLOAD_MB = 20;

// A small drawing of the app in a theme's colours.
function ThemePreview({ theme, glassBg }) {
  if (theme.id === 'glass') {
    return (
      <div className="tp tp-glass" style={{ background: glassBg }}>
        <span className="tp-side glass" />
        <span className="tp-main">
          <span className="tp-card glass" />
          <span className="tp-card glass short" />
        </span>
      </div>
    );
  }
  const p = theme.preview;
  return (
    <div className="tp" style={{ background: p.bg }}>
      <span className="tp-side" style={{ background: p.sidebar }} />
      <span className="tp-main">
        <span className="tp-card" style={{ background: p.surface, boxShadow: `0 0 0 1px ${p.line}` }}>
          <span className="tp-bar" style={{ background: p.accent }} />
        </span>
        <span className="tp-card short" style={{ background: p.surface, boxShadow: `0 0 0 1px ${p.line}` }} />
      </span>
    </div>
  );
}

export default function SettingsView({ appearance, onShowTour }) {
  const { settings, resolved, update, updateGlass, saveError } = appearance;
  const { glass } = settings;
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const glassBg = glassBackgroundCss(glass.background);
  const followsSystem = !settings.theme;

  const upload = async (file) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setUploadError('Choose an image file (JPG, PNG, WebP…).');
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setUploadError(`Choose an image under ${MAX_UPLOAD_MB} MB.`);
    setUploading(true);
    try {
      const { image, luminance } = await prepareImage(file);
      // Photos are busy: start with a light blur and dim so text reads well. Both are adjustable.
      updateGlass({
        background: { type: 'image', image },
        tint: tintFor(luminance),
        bgBlur: Math.max(glass.bgBlur ?? 0, 8),
        dim: Math.max(glass.dim ?? 0, 20),
      });
    } catch {
      setUploadError('That image could not be read. Try another one.');
    } finally {
      setUploading(false);
    }
  };

  // Pick the glass that reads best on a two-colour gradient.
  const gradientTint = (from, to) => tintFor((hexLuminance(from) + hexLuminance(to)) / 2);
  const setGradient = (patch) => {
    const next = { ...glass.background, ...patch, type: 'gradient' };
    updateGlass({ background: next, tint: gradientTint(next.from, next.to) });
  };

  const pickPreset = (preset) => updateGlass({ background: { type: 'preset', preset: preset.id }, tint: preset.tint });

  return (
    <div className="settings">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Appearance is saved in this browser only.</p>
        </div>
      </div>

      <section className="settings-card">
        <header className="settings-head">
          <div>
            <h2>Theme</h2>
            <p className="muted">Pick how the dashboard looks.</p>
          </div>
          <button
            className={followsSystem ? 'toggle-btn on-accent' : 'toggle-btn'}
            onClick={() => update({ theme: followsSystem ? resolved.mode : null })}
            aria-pressed={followsSystem}
            title="Use light or dark to match your computer"
          >
            <Monitor size={14} /> Match system
          </button>
        </header>
        <div className="theme-grid">
          {THEMES.map((theme) => {
            const active = resolved.theme === theme.id;
            return (
              <button
                key={theme.id}
                className={active ? 'theme-card active' : 'theme-card'}
                onClick={() => update({ theme: theme.id })}
                aria-pressed={active}
              >
                <ThemePreview theme={theme} glassBg={glassBg} />
                <span className="theme-card-text">
                  <strong>
                    {theme.name}
                    {active && <Check size={14} />}
                  </strong>
                  <span className="muted">{theme.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={resolved.theme === 'glass' ? 'settings-card' : 'settings-card dimmed'}>
        <header className="settings-head">
          <div>
            <h2>Liquid glass</h2>
            <p className="muted">
              {resolved.theme === 'glass'
                ? 'Choose what sits behind the glass.'
                : 'These apply when the Liquid glass theme is selected.'}
            </p>
          </div>
          {resolved.theme !== 'glass' && (
            <button className="secondary-btn" onClick={() => update({ theme: 'glass' })}>
              Use Liquid glass
            </button>
          )}
        </header>

        <div className="settings-row">
          <span className="settings-label">Background</span>
          <div className="bg-options">
            {GLASS_PRESETS.map((preset) => {
              const on = glass.background.type === 'preset' && glass.background.preset === preset.id;
              return (
                <button key={preset.id} className={on ? 'bg-swatch active' : 'bg-swatch'} onClick={() => pickPreset(preset)} aria-pressed={on}>
                  <span className="bg-thumb" style={{ background: preset.css }} />
                  <span>{preset.name}</span>
                </button>
              );
            })}
            <button
              className={glass.background.type === 'gradient' ? 'bg-swatch active' : 'bg-swatch'}
              onClick={() => setGradient({})}
              aria-pressed={glass.background.type === 'gradient'}
            >
              <span
                className="bg-thumb"
                style={{ background: `linear-gradient(${glass.background.angle}deg, ${glass.background.from}, ${glass.background.to})` }}
              />
              <span>Custom</span>
            </button>
            <button
              className={glass.background.type === 'image' ? 'bg-swatch active' : 'bg-swatch'}
              onClick={() => (glass.background.image ? updateGlass({ background: { type: 'image' } }) : fileRef.current?.click())}
              aria-pressed={glass.background.type === 'image'}
            >
              <span
                className="bg-thumb image"
                style={glass.background.image ? { backgroundImage: `url("${glass.background.image}")` } : undefined}
              >
                {!glass.background.image && (uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />)}
              </span>
              <span>Your image</span>
            </button>
          </div>
        </div>

        {glass.background.type === 'gradient' && (
          <div className="settings-row">
            <span className="settings-label">Custom gradient</span>
            <div className="gradient-controls">
              <label className="color-field">
                <input type="color" value={glass.background.from} onChange={(e) => setGradient({ from: e.target.value })} />
                <span>From</span>
              </label>
              <label className="color-field">
                <input type="color" value={glass.background.to} onChange={(e) => setGradient({ to: e.target.value })} />
                <span>To</span>
              </label>
              <label className="range-field">
                <span>Angle · {glass.background.angle}°</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={glass.background.angle}
                  onChange={(e) => updateGlass({ background: { angle: Number(e.target.value) } })}
                />
              </label>
            </div>
          </div>
        )}

        {glass.background.type === 'image' && (
          <div className="settings-row">
            <span className="settings-label">Your image</span>
            <div className="image-controls">
              <button className="secondary-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} Choose image
              </button>
              {glass.background.image && (
                <button
                  className="secondary-btn"
                  onClick={() => updateGlass({ background: { type: 'preset', image: null } })}
                  disabled={uploading}
                >
                  <Trash2 size={15} /> Remove
                </button>
              )}
              <span className="muted small">Large photos are resized. Stored only on this computer.</span>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {(uploadError || saveError) && <p className="form-error">{uploadError || saveError}</p>}

        <div className="settings-row">
          <span className="settings-label">Glass</span>
          <div className="segmented">
            {['light', 'dark'].map((tint) => (
              <button key={tint} className={glass.tint === tint ? 'active' : undefined} onClick={() => updateGlass({ tint })}>
                {tint === 'light' ? 'Light glass' : 'Dark glass'}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">Background blur</span>
          <label className="range-field wide">
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={glass.bgBlur ?? 0}
              onChange={(e) => updateGlass({ bgBlur: Number(e.target.value) })}
              aria-label="Background blur"
            />
            <span className="muted">{glass.bgBlur ? `${glass.bgBlur}px` : 'Off'}</span>
          </label>
        </div>

        <div className="settings-row">
          <span className="settings-label">{glass.tint === 'dark' ? 'Darken background' : 'Lighten background'}</span>
          <label className="range-field wide">
            <input
              type="range"
              min="0"
              max="70"
              step="5"
              value={glass.dim ?? 0}
              onChange={(e) => updateGlass({ dim: Number(e.target.value) })}
              aria-label="Dim background"
            />
            <span className="muted">{glass.dim ? `${glass.dim}%` : 'Off'}</span>
          </label>
        </div>

        <div className="settings-row">
          <span className="settings-label">Glass blur</span>
          <label className="range-field wide">
            <input
              type="range"
              min="6"
              max="40"
              step="1"
              value={glass.blur}
              onChange={(e) => updateGlass({ blur: Number(e.target.value) })}
              aria-label="Glass blur"
            />
            <span className="muted">{glass.blur}px</span>
          </label>
        </div>
      </section>
      <section className="settings-card">
        <header className="settings-head">
          <div>
            <h2>Welcome tour</h2>
            <p className="muted">A quick look at issues, the daily report, the leaderboard, themes and Claude.</p>
          </div>
          <button className="secondary-btn" onClick={onShowTour}>
            Show the welcome tour
          </button>
        </header>
      </section>
      <UpdatesCard />
    </div>
  );
}
