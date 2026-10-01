import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, LogOut, Pencil } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Avatar, { refreshAvatars } from './Avatar.jsx';
import ProfilePhotoCropModal from './ProfilePhotoCropModal.jsx';
import ProfilePhotoMenuModal from './ProfilePhotoMenuModal.jsx';

const SSO_PROFILE = 'https://sso.fistinnovations.com/profile';

export default function AccountSettings({ user, onLogout, onProfileUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef(null);
  const onProfileUpdateRef = useRef(onProfileUpdate);
  onProfileUpdateRef.current = onProfileUpdate;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.profile();
      setProfile(data);
      onProfileUpdateRef.current?.(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const userId = profile?.userId ?? user?.id;
  const displayName = profile?.name ?? user?.name ?? '';

  const onPickFile = (file) => {
    if (!file?.type.startsWith('image/')) {
      setError('Choose an image file (PNG, JPG, WEBP or GIF).');
      return;
    }
    setError('');
    setCropFile(file);
  };

  const onSavePhoto = async (blob) => {
    setSavingPhoto(true);
    setError('');
    try {
      const data = await api.uploadProfilePhoto(blob);
      setProfile(data);
      onProfileUpdateRef.current?.(data);
      refreshAvatars(data.userId ?? userId);
      setCropFile(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingPhoto(false);
    }
  };

  const onRemovePhoto = async () => {
    if (!profile?.hasPhoto || removing) return;
    if (!window.confirm('Remove your profile photo?')) return;
    setRemoving(true);
    setError('');
    try {
      const data = await api.deleteProfilePhoto();
      setProfile(data);
      onProfileUpdateRef.current?.(data);
      refreshAvatars(data.userId ?? userId);
      setPhotoMenuOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <section className="settings-card account-profile">
        <header className="settings-head">
          <div>
            <h2>Your account</h2>
            <p className="muted">Update your photo here. Name and email are managed in FIST SSO.</p>
          </div>
        </header>

        {loading && (
          <p className="loading-line account-loading">
            <Loader2 size={16} className="spin" /> Refreshing profile…
          </p>
        )}

        <div className="account-identity">
          <button
            type="button"
            className="account-photo-trigger"
            onClick={() => setPhotoMenuOpen(true)}
            aria-haspopup="dialog"
          >
            <Avatar id={userId} name={displayName} size="large" className="account-avatar" />
            <span className="account-photo-edit">
              <Pencil size={14} aria-hidden /> Edit photo
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="account-fields">
            <label className="field">
              <span>Name</span>
              <input className="input" type="text" value={displayName} readOnly aria-readonly="true" />
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" type="text" value={profile?.email ?? ''} readOnly aria-readonly="true" />
            </label>
          </div>
        </div>

        <div className="account-actions">
          <a className="secondary-btn" href={SSO_PROFILE} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Update name &amp; email in SSO
          </a>
          <button className="secondary-btn danger" onClick={onLogout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
      </section>

      <ProfilePhotoMenuModal
        userId={userId}
        name={displayName}
        hasPhoto={profile?.hasPhoto}
        open={photoMenuOpen}
        onClose={() => !removing && setPhotoMenuOpen(false)}
        onChangePhoto={() => fileRef.current?.click()}
        onRemovePhoto={onRemovePhoto}
        removing={removing}
      />

      {cropFile && (
        <ProfilePhotoCropModal
          file={cropFile}
          saving={savingPhoto}
          onClose={() => !savingPhoto && setCropFile(null)}
          onSave={onSavePhoto}
        />
      )}
    </>
  );
}
