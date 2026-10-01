import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  CornerDownRight,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { api, attachmentUrl, errorMessage } from '../api.js';
import { openInPms } from '../openInPms.js';
import { isBlank, sanitizeRichText } from '../richText.js';
import Avatar from './Avatar.jsx';
import Select from './Select.jsx';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const PRIORITY_COLORS = { urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2f7de1', none: '#9ca3af' };

function RichText({ html, empty }) {
  if (isBlank(html)) return <p className="muted">{empty}</p>;
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}

function Section({ icon: Icon, title, count, action, children }) {
  return (
    <section className="drawer-section">
      <header>
        <h3>
          <Icon size={15} /> {title}
          {count !== undefined && <span className="count-badge">{count}</span>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function Property({ label, children }) {
  return (
    <div className="property">
      <span className="property-label">{label}</span>
      <div className="property-value">{children}</div>
    </div>
  );
}

export default function IssueDrawer({
  issueId,
  colorFor,
  onOpenIssue,
  onClose,
  onChanged,
  onAddSubIssue,
  onGoToIssues,
  onOpenProject,
  onError,
}) {
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null); // which field is saving
  const [comment, setComment] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setDetail(await api.issue(issueId));
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setLoadError(err);
    }
  }, [issueId, onError]);

  useEffect(() => {
    setDetail(null);
    setComment('');
    setShowActivity(false);
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Runs a change, replaces the detail with the fresh copy, and tells the list.
  const save = async (field, action, successText) => {
    setBusy(field);
    try {
      const fresh = await action();
      setDetail(fresh);
      onChanged(fresh, successText);
      return true;
    } catch (err) {
      onError(err, `Could not update ${detail.key}: ${errorMessage(err)}`);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = (stateId) =>
    save(
      'status',
      async () => {
        await api.setState(issueId, stateId);
        return api.issue(issueId);
      },
      'Status updated',
    );
  const changePriority = (priority) => save('priority', () => api.setPriority(issueId, priority), 'Priority updated');
  const changeAssignee = (userId) => save('assignee', () => api.setAssignee(issueId, userId), 'Assignee updated');
  const addComment = async () => {
    if (!comment.trim()) return;
    if (await save('comment', () => api.comment(issueId, comment.trim()), 'Comment added')) setComment('');
  };

  const selectedStateId = detail?.states.find((s) => s.name.toLowerCase() === detail.status.name.toLowerCase())?.id;

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Issue details">
        <div className="drawer-top">
          <span className="key">{detail?.key ?? '…'}</span>
          <div className="drawer-top-actions">
            <button
              type="button"
              className="icon-btn"
              title="Open in PMS"
              onClick={() => openInPms(`/issues/${issueId}`, onError)}
            >
              <ExternalLink size={17} />
            </button>
            <button className="icon-btn" onClick={onClose} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        {!detail && !loadError && (
          <div className="drawer-loading">
            <Loader2 size={22} className="spin" />
          </div>
        )}

        {loadError && (
          <div className="drawer-body">
            <div className="error-card">
              <div>
                <strong>Could not load this issue</strong>
                <p>{errorMessage(loadError)}</p>
              </div>
              <button className="secondary-btn" onClick={load}>Try again</button>
            </div>
          </div>
        )}

        {detail && (
          <div className="drawer-body">
            {(onGoToIssues || detail.project) && (
              <div className="drawer-context">
                {onGoToIssues && (
                  <button type="button" className="drawer-context-link" onClick={() => (onClose(), onGoToIssues())}>
                    My Issues
                  </button>
                )}
                {onGoToIssues && detail.project && <span className="muted">·</span>}
                {detail.project && onOpenProject && (
                  <button
                    type="button"
                    className="drawer-context-link"
                    onClick={() => (onClose(), onOpenProject(detail.project))}
                  >
                    {detail.project.name}
                  </button>
                )}
              </div>
            )}

            {detail.parentIssue && (
              <button
                type="button"
                className="parent-issue-link"
                onClick={() => onOpenIssue(detail.parentIssue.id)}
              >
                <CornerDownRight size={15} />
                <span>
                  Sub-issue of <span className="key">{detail.parentIssue.key}</span>
                  {detail.parentIssue.title ? ` · ${detail.parentIssue.title}` : ''}
                </span>
              </button>
            )}

            <h2 className="drawer-title">{detail.title}</h2>

            <div className="properties">
              <Property label="Status">
                <Select
                  variant="prop"
                  ariaLabel="Status"
                  value={selectedStateId ?? ''}
                  disabled={busy === 'status'}
                  onChange={changeStatus}
                  options={[
                    ...(selectedStateId ? [] : [{ value: '', label: detail.status.name, dot: detail.status.color ?? '#94a3b8' }]),
                    ...detail.states.map((s) => ({ value: s.id, label: s.name, dot: colorFor(s.name) ?? '#94a3b8' })),
                  ]}
                />
                {busy === 'status' && <Loader2 size={14} className="spin" />}
              </Property>

              <Property label="Priority">
                <Select
                  variant="prop"
                  className={`capitalize priority-${detail.priority}`}
                  ariaLabel="Priority"
                  value={detail.priority}
                  disabled={busy === 'priority'}
                  onChange={changePriority}
                  options={PRIORITIES.map((p) => ({ value: p, label: p, dot: PRIORITY_COLORS[p] }))}
                />
                {busy === 'priority' && <Loader2 size={14} className="spin" />}
              </Property>

              <Property label="Assignee">
                {detail.assigneeLocked ? (
                  <span className="locked" title="Reopen this issue in the PMS to change the assignee">
                    {detail.assignee?.name ?? 'Unassigned'}
                  </span>
                ) : (
                  <Select
                    variant="prop"
                    ariaLabel="Assignee"
                    searchable
                    value={detail.assignee?.id ?? ''}
                    disabled={busy === 'assignee'}
                    onChange={changeAssignee}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...detail.assignees.map((a) => ({ value: a.id, label: a.name, person: a })),
                    ]}
                  />
                )}
                {busy === 'assignee' && <Loader2 size={14} className="spin" />}
              </Property>

              <Property label="Project">
                <span>{detail.project?.name ?? '—'}</span>
              </Property>

              <Property label="Timeline">
                {detail.timeline.start || detail.timeline.target ? (
                  <span className="timeline">
                    {detail.timeline.start ?? '—'} <ArrowRight size={13} /> {detail.timeline.target ?? '—'}
                  </span>
                ) : (
                  <span className="muted">No dates</span>
                )}
              </Property>

              <Property label="Labels">
                {detail.labels.length ? (
                  <span className="labels">
                    {detail.labels.map((l) => (
                      <span key={l.name} className="label-chip" style={{ '--c': l.color ?? '#64748b' }}>
                        {l.name}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted">None</span>
                )}
              </Property>
            </div>

            <Section icon={FileText} title="Description">
              <RichText html={detail.descriptionHtml} empty="No description." />
            </Section>

            <Section
              icon={ChevronRight}
              title="Sub-issues"
              count={detail.subIssues.length}
              action={
                detail.project && (
                  <button className="link-btn" onClick={() => onAddSubIssue(detail)}>
                    <Plus size={14} /> Add
                  </button>
                )
              }
            >
              {detail.subIssues.length ? (
                <ul className="sub-list">
                  {detail.subIssues.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => onOpenIssue(s.id)}>
                        <span className="key">{s.key}</span>
                        <span className="sub-title">{s.title}</span>
                        <ChevronRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No sub-issues.</p>
              )}
            </Section>

            <Section icon={Paperclip} title="Attachments" count={detail.attachments.length}>
              {detail.attachments.length ? (
                <ul className="attachment-list">
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <FileText size={16} />
                      <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="attachment-name" title={a.name}>
                        {a.name}
                      </a>
                      <span className="muted">{a.size}</span>
                      <a className="icon-btn" href={attachmentUrl(a.id, true)} title="Download">
                        <Download size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No attachments.</p>
              )}
            </Section>

            <Section icon={MessageSquare} title="Comments" count={detail.comments.length}>
              {detail.comments.length > 0 && (
                <ul className="comment-list">
                  {detail.comments.map((c, i) => (
                    <li key={i}>
                      <Avatar id={c.authorId} name={c.author} size="small" />
                      <div>
                        <div className="comment-meta">
                          <strong>{c.author}</strong> <span className="muted">{c.at}</span>
                        </div>
                        <RichText html={c.html} empty="(empty comment)" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="comment-box">
                <textarea
                  rows={3}
                  placeholder="Add a comment…  (Ctrl+Enter to send)"
                  value={comment}
                  disabled={busy === 'comment'}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && addComment()}
                />
                <button className="primary-btn small" disabled={!comment.trim() || busy === 'comment'} onClick={addComment}>
                  {busy === 'comment' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Comment
                </button>
              </div>
            </Section>

            {detail.activity.length > 0 && (
              <Section
                icon={History}
                title="Activity"
                count={detail.activity.length}
                action={
                  <button className="link-btn" onClick={() => setShowActivity((v) => !v)}>
                    {showActivity ? 'Hide' : 'Show'}
                  </button>
                }
              >
                {showActivity && (
                  <ol className="activity-list">
                    {detail.activity.map((a, i) => (
                      <li key={i}>
                        <span>
                          <strong>{a.who}</strong> {a.text}
                        </span>
                        <span className="muted">{a.at}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
