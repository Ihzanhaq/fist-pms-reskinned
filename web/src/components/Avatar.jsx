import { useState } from 'react';

// Ids with no photo, remembered briefly so a newly uploaded photo still shows up.
const NO_PHOTO_MS = 2 * 60_000;
const noPhoto = new Map(); // id -> time we found there was none
const hasNoPhoto = (id) => Date.now() - (noPhoto.get(id) ?? -Infinity) < NO_PHOTO_MS;

// Changes every 10 minutes: picks up new photos and skips any stale cached "not found".
const cacheBucket = () => Math.floor(Date.now() / (10 * 60_000));

// Profile photo from the PMS, falling back to the person's initial.
export default function Avatar({ id, name, size = 'tiny', className = '' }) {
  const [failedId, setFailedId] = useState(null);
  const showInitial = !id || hasNoPhoto(id) || failedId === id;
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '–';
  const classes = `avatar ${size} ${className}`.replace(/\s+/g, ' ').trim();

  if (showInitial) return <span className={classes} aria-hidden="true">{initial}</span>;
  return (
    <img
      className={`${classes} photo`}
      src={`/api/avatars/${id}?v=${cacheBucket()}`}
      alt=""
      loading="lazy"
      onError={() => {
        noPhoto.set(id, Date.now());
        setFailedId(id);
      }}
    />
  );
}
