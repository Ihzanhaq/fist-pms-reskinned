import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, ZoomIn } from 'lucide-react';
import {
  CROP_VIEWPORT,
  drawCropPreview,
  exportCroppedPhoto,
  clampPan,
  zoomAtPoint,
  zoomByFactor,
} from '../avatarCrop.js';

const pointerDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export default function ProfilePhotoCropModal({ file, onClose, onSave, saving }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const bitmapRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const pointersRef = useRef(new Map());
  const viewRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  viewRef.current = { zoom, pan };

  const applyView = useCallback((next) => {
    const bitmap = bitmapRef.current;
    const pan = bitmap ? clampPan(bitmap, next.zoom, next.panX, next.panY) : { panX: next.panX, panY: next.panY };
    setZoom(next.zoom);
    setPan({ x: pan.panX, y: pan.panY });
  }, []);

  useEffect(() => {
    if (!file) return;
    let live = true;
    setReady(false);
    setError('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pointersRef.current.clear();
    pinchRef.current = null;
    dragRef.current = null;
    createImageBitmap(file)
      .then((bitmap) => {
        if (!live) {
          bitmap.close?.();
          return;
        }
        bitmapRef.current?.close?.();
        bitmapRef.current = bitmap;
        setReady(true);
      })
      .catch(() => live && setError('That image could not be opened. Try another file.'));
    return () => {
      live = false;
    };
  }, [file]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;
    drawCropPreview(canvas.getContext('2d'), bitmap, zoom, pan.x, pan.y);
  }, [zoom, pan.x, pan.y]);

  useEffect(() => {
    paint();
  }, [paint, ready]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ready) return;

    const onWheel = (e) => {
      if (saving) return;
      e.preventDefault();
      const bitmap = bitmapRef.current;
      if (!bitmap) return;
      const rect = stage.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { zoom: z, pan: p } = viewRef.current;
      // Trackpad pinch sends wheel + ctrl; mouse wheel sends plain wheel.
      const sensitivity = e.ctrlKey ? 0.012 : 0.003;
      const factor = Math.exp(-e.deltaY * sensitivity);
      applyView(zoomByFactor(bitmap, z, p.x, p.y, mx, my, factor));
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [applyView, ready, saving]);

  const onPointerDown = (e) => {
    if (saving) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      pinchRef.current = null;
      return;
    }
    if (pointersRef.current.size === 2) {
      dragRef.current = null;
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: pointerDistance(pts[0], pts[1]),
        zoom,
        panX: pan.x,
        panY: pan.y,
        anchor: {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        },
      };
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const bitmap = bitmapRef.current;
      const pts = [...pointersRef.current.values()];
      if (pts.length < 2 || !bitmap) return;
      const dist = pointerDistance(pts[0], pts[1]);
      const { dist: startDist, zoom: startZoom, panX, panY, anchor } = pinchRef.current;
      if (!startDist) return;
      const rect = stageRef.current.getBoundingClientRect();
      const mx = anchor.x - rect.left;
      const my = anchor.y - rect.top;
      applyView(zoomAtPoint(bitmap, startZoom, panX, panY, mx, my, startZoom * (dist / startDist)));
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const bitmap = bitmapRef.current;
    const rawX = drag.panX + (e.clientX - drag.x);
    const rawY = drag.panY + (e.clientY - drag.y);
    if (!bitmap) {
      setPan({ x: rawX, y: rawY });
      return;
    }
    const c = clampPan(bitmap, zoom, rawX, rawY);
    setPan({ x: c.panX, y: c.panY });
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      const bitmap = bitmapRef.current;
      if (bitmap) {
        const c = clampPan(bitmap, zoom, pan.x, pan.y);
        if (c.panX !== pan.x || c.panY !== pan.y) setPan({ x: c.panX, y: c.panY });
      }
    }
  };

  const onSliderZoom = (nextZoom) => {
    const bitmap = bitmapRef.current;
    if (!bitmap) {
      setZoom(nextZoom);
      return;
    }
    const mx = CROP_VIEWPORT / 2;
    const my = CROP_VIEWPORT / 2;
    applyView(zoomAtPoint(bitmap, zoom, pan.x, pan.y, mx, my, nextZoom));
  };

  const save = async () => {
    const bitmap = bitmapRef.current;
    if (!bitmap || saving) return;
    setError('');
    try {
      const blob = await exportCroppedPhoto(bitmap, zoom, pan.x, pan.y);
      await onSave(blob);
    } catch (err) {
      setError(err.message ?? 'Could not save the photo');
    }
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal profile-crop-modal" role="dialog" aria-labelledby="crop-title" aria-modal="true">
        <div className="modal-head">
          <h2 id="crop-title">Crop profile photo</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body crop-body">
          <p className="muted crop-hint">Drag to reposition · scroll or pinch to zoom</p>
          <div
            ref={stageRef}
            className="crop-stage"
            style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} width={CROP_VIEWPORT} height={CROP_VIEWPORT} className="crop-canvas" />
            <div className="crop-grid" aria-hidden="true" />
            {!ready && !error && (
              <div className="crop-loading">
                <Loader2 size={22} className="spin" />
              </div>
            )}
          </div>
          <label className="crop-zoom">
            <ZoomIn size={16} />
            <input
              type="range"
              min="1"
              max="3"
              step="0.02"
              value={zoom}
              disabled={!ready || saving}
              onChange={(e) => onSliderZoom(Number(e.target.value))}
              aria-label="Zoom"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={save} disabled={!ready || saving}>
            {saving ? <Loader2 size={16} className="spin" /> : null}
            Save photo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
