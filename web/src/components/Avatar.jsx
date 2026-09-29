import { useState } from 'react';

// Ids known to have no photo, so later renders go straight to the initial.
const noPhoto = new Set();

// Profile photo from the PMS, falling back to the person's initial.
export default function Avatar({ id, name, size = 'tiny', className = '' }) {
  const [failedId, setFailedId] = useState(null);
  const showInitial = !id || noPhoto.has(id) || failedId === id;
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '–';
  const classes = `avatar ${size} ${className}`.replace(/\s+/g, ' ').trim();

  if (showInitial) return <span className={classes} aria-hidden="true">{initial}</span>;
  return (
    <img
      className={`${classes} photo`}
      src={`/api/avatars/${id}`}
      alt=""
      loading="lazy"
      onError={() => {
        noPhoto.add(id);
        setFailedId(id);
      }}
    />
  );
}
