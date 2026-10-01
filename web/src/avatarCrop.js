const VIEWPORT = 300;

export function cropTransform(bitmap, zoom, panX, panY) {
  const base = Math.max(VIEWPORT / bitmap.width, VIEWPORT / bitmap.height);
  const scale = base * zoom;
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const x = (VIEWPORT - w) / 2 + panX;
  const y = (VIEWPORT - h) / 2 + panY;
  return { x, y, w, h };
}

export function drawCropPreview(ctx, bitmap, zoom, panX, panY) {
  const { x, y, w, h } = cropTransform(bitmap, zoom, panX, panY);
  ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);
  ctx.drawImage(bitmap, x, y, w, h);
}

const clampZoom = (zoom) => Math.min(3, Math.max(1, zoom));

/** Keep pan within bounds so the scaled image always covers the square viewport. */
export function clampPan(bitmap, zoom, panX, panY) {
  const base = Math.max(VIEWPORT / bitmap.width, VIEWPORT / bitmap.height);
  const scale = base * zoom;
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;

  const clampAxis = (pan, size) => {
    if (size <= VIEWPORT) return 0;
    const min = (VIEWPORT - size) / 2;
    const max = (size - VIEWPORT) / 2;
    return Math.min(max, Math.max(min, pan));
  };

  return { panX: clampAxis(panX, w), panY: clampAxis(panY, h) };
}

/** Zoom while keeping the point under (mx, my) fixed on the image. */
export function zoomAtPoint(bitmap, zoom, panX, panY, mx, my, nextZoom) {
  const newZoom = clampZoom(nextZoom);
  if (newZoom === zoom) return { zoom, ...clampPan(bitmap, zoom, panX, panY) };
  const ratio = newZoom / zoom;
  const { x, y, w, h } = cropTransform(bitmap, zoom, panX, panY);
  const w2 = w * ratio;
  const h2 = h * ratio;
  const x2 = mx - (mx - x) * ratio;
  const y2 = my - (my - y) * ratio;
  const nextPanX = x2 - (VIEWPORT - w2) / 2;
  const nextPanY = y2 - (VIEWPORT - h2) / 2;
  return { zoom: newZoom, ...clampPan(bitmap, newZoom, nextPanX, nextPanY) };
}

export function zoomByFactor(bitmap, zoom, panX, panY, mx, my, factor) {
  return zoomAtPoint(bitmap, zoom, panX, panY, mx, my, zoom * factor);
}

/** Square JPEG blob for PMS profile upload (max side 512). */
export async function exportCroppedPhoto(bitmap, zoom, panX, panY, size = 512) {
  const preview = document.createElement('canvas');
  preview.width = VIEWPORT;
  preview.height = VIEWPORT;
  drawCropPreview(preview.getContext('2d'), bitmap, zoom, panX, panY);

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  out.getContext('2d').drawImage(preview, 0, 0, size, size);

  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not prepare the cropped photo');
  return blob;
}

export const CROP_VIEWPORT = VIEWPORT;
