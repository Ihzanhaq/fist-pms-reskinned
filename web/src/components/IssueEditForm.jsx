import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import DatePicker from './DatePicker.jsx';
import RichEditor from './RichEditor.jsx';

// Images pasted in the PMS are custom elements Quill would silently drop on save.
const hasImages = (html) => /<(image-component|img)\b/i.test(html ?? '');

// Edits title, description, dates and labels. The PMS saves them together in one form.
export default function IssueEditForm({ issueId, onSave, onCancel, onError }) {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [descTouched, setDescTouched] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .issueEditForm(issueId)
      .then((f) => {
        if (!live) return;
        const initial = {
          name: f.name.trim(),
          descriptionHtml: f.descriptionHtml,
          startDate: f.startDate,
          targetDate: f.targetDate,
          labelIds: f.labelIds,
        };
        setForm({ ...f, initial });
        setValues(initial);
      })
      .catch((err) => {
        if (!live) return;
        if (err.code === 'session_expired') onError(err);
        setLoadError(err);
      });
    return () => {
      live = false;
    };
  }, [issueId, onError]);

  if (loadError) {
    return (
      <div className="error-card">
        <div>
          <strong>Could not load the edit form</strong>
          <p>{errorMessage(loadError)}</p>
        </div>
        <button className="secondary-btn" onClick={onCancel}>Back</button>
      </div>
    );
  }
  if (!values) {
    return (
      <p className="muted loading-line">
        <Loader2 size={14} className="spin" /> Loading…
      </p>
    );
  }

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));
  const toggleLabel = (id) =>
    set('labelIds')(values.labelIds.includes(id) ? values.labelIds.filter((l) => l !== id) : [...values.labelIds, id]);
  const datesInvalid = values.startDate && values.targetDate && values.targetDate < values.startDate;

  // Send only what changed; an untouched description is re-sent exactly as the PMS stored it.
  const { initial } = form;
  const patch = {};
  if (values.name.trim() !== initial.name) patch.name = values.name.trim();
  if (descTouched && values.descriptionHtml !== initial.descriptionHtml) patch.descriptionHtml = values.descriptionHtml;
  if (values.startDate !== initial.startDate) patch.startDate = values.startDate;
  if (values.targetDate !== initial.targetDate) patch.targetDate = values.targetDate;
  if ([...values.labelIds].sort().join() !== [...initial.labelIds].sort().join()) patch.labelIds = values.labelIds;
  const changed = Object.keys(patch).length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!changed || saving || datesInvalid || !values.name.trim()) return;
    setSaving(true);
    const ok = await onSave(patch);
    if (!ok) setSaving(false);
  };

  return (
    <form className="issue-edit" onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input
          className="input title-input"
          autoFocus
          value={values.name}
          maxLength={500}
          disabled={saving}
          onChange={(e) => set('name')(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Description</span>
        {hasImages(initial.descriptionHtml) ? (
          <small className="muted">This description has images, so edit it in the PMS to keep them.</small>
        ) : (
          <RichEditor
            value={initial.descriptionHtml}
            placeholder="Add a description…"
            disabled={saving}
            onChange={(html) => {
              setDescTouched(true);
              set('descriptionHtml')(html);
            }}
          />
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <span>Start date</span>
          <DatePicker ariaLabel="Start date" value={values.startDate} disabled={saving} onChange={set('startDate')} />
        </div>
        <div className="field">
          <span>Target date</span>
          <DatePicker
            ariaLabel="Target date"
            value={values.targetDate}
            min={values.startDate || undefined}
            disabled={saving}
            onChange={set('targetDate')}
          />
        </div>
      </div>
      {datesInvalid && <p className="form-error">Target date is before the start date.</p>}

      {form.labels.length > 0 && (
        <div className="field">
          <span>Labels</span>
          <div className="label-picker">
            {form.labels.map((l) => (
              <button
                type="button"
                key={l.id}
                className={values.labelIds.includes(l.id) ? 'label-chip selectable on' : 'label-chip selectable'}
                style={{ '--c': l.color ?? '#64748b' }}
                onClick={() => toggleLabel(l.id)}
                aria-pressed={values.labelIds.includes(l.id)}
                disabled={saving}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="issue-edit-actions">
        <button type="button" className="secondary-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="submit"
          className="primary-btn"
          disabled={!changed || saving || datesInvalid || !values.name.trim()}
        >
          {saving && <Loader2 size={15} className="spin" />} Save
        </button>
      </div>
    </form>
  );
}
