import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { api, errorMessage } from '../api.js';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const LAST_PROJECT_KEY = 'pms-dashboard:last-project';

const EMPTY = {
  name: '',
  description: '',
  stateId: '',
  priority: 'none',
  assigneeId: '',
  labelIds: [],
  startDate: '',
  targetDate: '',
};

// `parent` is set when adding a sub-issue: { id, key, project: { id, name } }.
export default function CreateIssueModal({ parent, userName, onClose, onCreated, onError }) {
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState(parent?.project.id ?? localStorage.getItem(LAST_PROJECT_KEY) ?? '');
  const [form, setForm] = useState(null); // options for the chosen project
  const [formError, setFormError] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    if (parent) return;
    api
      .projects()
      .then(({ projects }) => setProjects(projects))
      .catch((err) => onError(err));
  }, [parent, onError]);

  // Status, assignee and label options differ per project.
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    setForm(null);
    setFormError(null);
    api
      .issueForm(projectId, parent?.id)
      .then((f) => {
        if (!live) return;
        setForm(f);
        const me = f.assignees.find((a) => a.name === userName);
        setValues((v) => ({
          ...v,
          stateId: f.states.find((s) => s.selected)?.id ?? f.states[0]?.id ?? '',
          assigneeId: me?.id ?? '',
          labelIds: [],
        }));
      })
      .catch((err) => {
        if (!live) return;
        if (err.code === 'session_expired') onError(err);
        setFormError(err);
      });
    return () => {
      live = false;
    };
  }, [projectId, parent, userName, onError]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !submitting && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const datesInvalid = values.startDate && values.targetDate && values.targetDate < values.startDate;
  const canSubmit = form && values.name.trim() && !datesInvalid && !submitting;
  const projectName = useMemo(
    () => parent?.project.name ?? projects?.find((p) => p.id === projectId)?.name,
    [parent, projects, projectId],
  );

  const toggleLabel = (id) =>
    set('labelIds')(values.labelIds.includes(id) ? values.labelIds.filter((l) => l !== id) : [...values.labelIds, id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { id } = await api.createIssue(projectId, { ...values, parentId: parent?.id ?? null });
      if (!parent) localStorage.setItem(LAST_PROJECT_KEY, projectId);
      onCreated(id, values.name.trim());
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setSubmitError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="New issue">
        <header className="modal-head">
          <div>
            <h2>{parent ? 'New sub-issue' : 'New issue'}</h2>
            {parent && <p className="muted">Under {parent.key} · {parent.project.name}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={submitting} title="Close (Esc)">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          {!parent && (
            <label className="field">
              <span>Project</span>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="" disabled>{projects ? 'Choose a project…' : 'Loading projects…'}</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Title</span>
            <input
              className="input title-input"
              autoFocus
              placeholder="What needs to be done?"
              value={values.name}
              maxLength={500}
              onChange={(e) => set('name')(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              className="input"
              rows={5}
              placeholder="Add details (optional)"
              value={values.description}
              onChange={(e) => set('description')(e.target.value)}
            />
          </label>

          {projectId && !form && !formError && (
            <p className="muted loading-line">
              <Loader2 size={14} className="spin" /> Loading options for {projectName ?? 'project'}…
            </p>
          )}
          {formError && <p className="form-error">Could not load project options: {errorMessage(formError)}</p>}

          {form && (
            <>
              <div className="field-row">
                <label className="field">
                  <span>Status</span>
                  <select className="input" value={values.stateId} onChange={(e) => set('stateId')(e.target.value)}>
                    {form.states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Assignee</span>
                  <select className="input" value={values.assigneeId} onChange={(e) => set('assigneeId')(e.target.value)}>
                    <option value="">Unassigned</option>
                    {form.assignees.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field">
                <span>Priority</span>
                <div className="segmented">
                  {PRIORITIES.map((p) => (
                    <button
                      type="button"
                      key={p}
                      className={values.priority === p ? `active priority-${p}` : undefined}
                      onClick={() => set('priority')(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Start date</span>
                  <input type="date" className="input" value={values.startDate} onChange={(e) => set('startDate')(e.target.value)} />
                </label>
                <label className="field">
                  <span>Target date</span>
                  <input
                    type="date"
                    className="input"
                    value={values.targetDate}
                    min={values.startDate || undefined}
                    onChange={(e) => set('targetDate')(e.target.value)}
                  />
                </label>
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
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {submitError && <p className="form-error">Could not create the issue: {errorMessage(submitError)}</p>}
        </div>

        <footer className="modal-foot">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> Creating…
              </>
            ) : (
              'Create issue'
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
