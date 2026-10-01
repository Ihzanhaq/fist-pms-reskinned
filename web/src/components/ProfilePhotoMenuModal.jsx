import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import Avatar from './Avatar.jsx';

export default function ProfilePhotoMenuModal({
  userId,
  name,
  hasPhoto,
  open,
  onClose,
  onChangePhoto,
  onRemovePhoto,
  removing,
}) {
  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !removing && onClose()}>
      <div className="modal profile-photo-menu" role="dialog" aria-labelledby="photo-menu-title" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2 id="photo-menu-title">Profile photo</h2>
            <p className="muted">PNG, JPG, WEBP or GIF · up to 8 MB · cropped to a square</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={removing} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body profile-photo-menu-body">
          <Avatar id={userId} name={name} size="large" className="account-avatar menu-preview" />
          <div className="profile-photo-menu-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                onClose();
                onChangePhoto();
              }}
              disabled={removing}
            >
              <ImagePlus size={15} /> Change photo
            </button>
            {hasPhoto && (
              <button type="button" className="secondary-btn danger" onClick={onRemovePhoto} disabled={removing}>
                {removing ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Remove photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
