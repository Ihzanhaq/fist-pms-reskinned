// Bulk status / assignee changes shared by My Issues and the project issue list.
import { api, loadPeople, loadStates, runPool } from './api.js';

// status: a status name, or '' to leave statuses alone.
// person: { id, name } to assign, null to unassign, undefined to leave assignees alone.
// patch(id, fields) updates the caller's list; colorFor(name) colours statuses.
// Resolves to { message, failed } where failed are the issues to keep selected.
export async function runBulk(issues, { status, person }, { patch, colorFor, onError }) {
  const failed = new Set();
  const parts = [];
  const fail = (issue, err) => {
    failed.add(issue);
    if (err?.code === 'session_expired') onError?.(err);
  };

  if (status) {
    const wanted = status.toLowerCase();
    const jobs = [];
    let unchanged = 0;
    let unavailable = 0;
    for (const issue of issues) {
      if (issue.status.name.toLowerCase() === wanted) {
        unchanged++;
        continue;
      }
      const states = await loadStates(issue).catch(() => null);
      const state = states?.find((s) => s.name.toLowerCase() === wanted);
      if (!states) failed.add(issue);
      else if (!state) unavailable++;
      else jobs.push({ issue, state });
    }
    let updated = 0;
    await runPool(jobs, 3, async ({ issue, state }) => {
      const previous = issue.status;
      patch(issue.id, { status: { name: state.name, color: colorFor(state.name) } });
      try {
        const { status: fresh } = await api.setState(issue.id, state.id);
        patch(issue.id, { status: { name: fresh.name, color: colorFor(fresh.name) } });
        updated++;
      } catch (err) {
        patch(issue.id, { status: previous });
        fail(issue, err);
      }
    });
    parts.push(`${updated} moved to ${status}`);
    if (unchanged) parts.push(`${unchanged} already there`);
    if (unavailable) parts.push(`${unavailable} skipped (status not in project)`);
  }

  if (person !== undefined) {
    const jobs = [];
    let unchanged = 0;
    let unavailable = 0;
    for (const issue of issues) {
      // Rows that carry an assignee can skip no-op changes.
      if ('assignee' in issue && (issue.assignee?.name ?? null) === (person?.name ?? null)) {
        unchanged++;
        continue;
      }
      if (person) {
        const people = await loadPeople(issue).catch(() => null);
        if (!people) {
          failed.add(issue);
          continue;
        }
        if (!people.some((p) => p.id === person.id)) {
          unavailable++;
          continue;
        }
      }
      jobs.push(issue);
    }
    let updated = 0;
    await runPool(jobs, 3, async (issue) => {
      try {
        const fresh = await api.setAssignee(issue.id, person?.id ?? '');
        patch(issue.id, { assignee: fresh.assignee });
        updated++;
      } catch (err) {
        fail(issue, err);
      }
    });
    parts.push(person ? `${updated} assigned to ${person.name}` : `${updated} unassigned`);
    if (unchanged) parts.push(`${unchanged} unchanged`);
    if (unavailable) parts.push(`${unavailable} skipped (${person.name} not in project)`);
  }

  if (failed.size) parts.push(`${failed.size} failed`);
  return { message: parts.join(' · '), failed: [...failed] };
}
