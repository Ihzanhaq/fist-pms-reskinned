// MCP tools for FIST PMS. Claude works with keys and names; this file maps
// them to PMS ids and calls the shared service.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LATEST_FILE, compareVersions } from '../server/extension.js';
import { LayoutChangedError } from '../server/parse.js';
import { PmsError, SessionExpiredError } from '../server/pms-client.js';
import * as service from '../server/service.js';
import { BadRequestError, PRIORITIES } from '../server/service.js';
import * as session from '../server/session.js';
import { NoMatchError, findByName, parseIssueRef } from '../server/match.js';
import { issueDetailText, issueLine, issueUrl } from './format.js';

const LIST_CACHE_MS = 60_000;

const READ = { readOnlyHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

let loginError = null;

// Opens the sign-in window without waiting for it, so the tool call returns quickly.
function startLogin() {
  loginError = null;
  session.login().catch((err) => {
    loginError = err.message;
  });
}

const readVersion = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).version ?? null;
  } catch {
    return null;
  }
};

// The packed extension has manifest.json beside mcp/; a repo checkout has it in extension/.
const OWN_VERSION =
  readVersion(path.resolve(import.meta.dirname, '..', 'manifest.json')) ??
  readVersion(path.resolve(import.meta.dirname, '..', 'extension', 'manifest.json'));

// The dashboard records the newest extension version it has. Told once per Claude session.
let updateNoticeShown = false;
function updateNotice() {
  if (updateNoticeShown || !OWN_VERSION) return null;
  const latest = readVersion(LATEST_FILE);
  if (!latest || compareVersions(OWN_VERSION, latest) >= 0) return null;
  updateNoticeShown = true;
  return (
    `Note for the user: a newer FIST PMS extension (v${latest}, installed v${OWN_VERSION}) is available. ` +
    'To update, open the PMS dashboard and click "Update" on the Claude extension banner.'
  );
}

// Turns errors into messages Claude can act on, and adds the update notice once.
function wrap(handler) {
  return async (args) => {
    const result = await run(handler, args);
    const notice = updateNotice();
    if (notice) result.content.push({ type: 'text', text: notice });
    return result;
  };
}

async function run(handler, args) {
  try {
    return await handler(args);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      startLogin();
      return fail(
        'Not signed in to FIST PMS. A sign-in window has been opened on this computer. ' +
          'Ask the user to sign in there, then try again.',
      );
    }
    if (err instanceof NoMatchError || err instanceof BadRequestError) return fail(err.message);
    if (err instanceof LayoutChangedError) return fail(`The PMS page layout changed, so it could not be read: ${err.message}`);
    if (err instanceof PmsError) return fail(err.message);
    return fail(`Unexpected error: ${err.message}`);
  }
}

// ---------- lookups ----------

let listCache = { at: 0, issues: [] };

async function allMyIssues(fresh = false) {
  if (fresh || Date.now() - listCache.at > LIST_CACHE_MS) {
    listCache = { at: Date.now(), issues: await service.listMyIssues('all') };
  }
  return listCache.issues;
}

// Issue keys can only be looked up among the user's own issues (that is all /my-issues shows).
async function resolveIssueId(ref) {
  const parsed = parseIssueRef(ref);
  if (parsed.id) return parsed.id;
  const find = (list) => list.find((i) => i.key === parsed.key);
  const hit = find(await allMyIssues()) ?? find(await allMyIssues(true));
  if (!hit) {
    throw new NoMatchError(
      `${parsed.key} is not one of your issues, so it cannot be found by key. Pass its PMS link or id instead ` +
        '(ids are shown for sub-issues in get_issue).',
    );
  }
  return hit.id;
}

async function resolveProject(name) {
  return findByName(await service.listProjects(), name, 'project');
}

let me = null;
async function myName() {
  me ??= (await service.sessionInfo()).userName ?? null;
  return me;
}

async function resolvePerson(people, name) {
  if (/^me$|^myself$/i.test(String(name).trim())) {
    const mine = await myName();
    const hit = people.find((p) => p.name === mine);
    if (!hit) throw new NoMatchError('You cannot be assigned in this project');
    return hit;
  }
  return findByName(people, name, 'assignee');
}

const isUnassign = (name) => /^(none|nobody|unassigned?|no one)$/i.test(String(name).trim());

// ---------- tools ----------

export function registerTools(server) {
  server.registerTool(
    'check_login',
    {
      title: 'Check PMS login',
      description: 'Shows whether FIST PMS is signed in and as whom. Opens a sign-in window on this computer if not.',
      annotations: READ,
    },
    wrap(async () => {
      const info = await service.sessionInfo();
      if (info.loggedIn) return text(`Signed in to FIST PMS as ${info.userName}.`);
      startLogin();
      return text(
        loginError
          ? `Not signed in. Opening the sign-in window failed: ${loginError}`
          : 'Not signed in. A sign-in window has been opened on this computer; ask the user to sign in there.',
      );
    }),
  );

  server.registerTool(
    'list_my_issues',
    {
      title: 'List my issues',
      description:
        "Lists the user's FIST PMS issues (issues assigned to them). One line per issue: key · title · project · status · priority · due date.",
      inputSchema: {
        include_completed: z.boolean().optional().describe('Include closed/done issues. Default false (active only).'),
        project: z.string().optional().describe('Only issues whose project name contains this text'),
        status: z.string().optional().describe('Only issues with this status name, e.g. "In Progress"'),
        search: z.string().optional().describe('Text to find in the key or title'),
        overdue_only: z.boolean().optional().describe('Only issues past their target date'),
      },
      annotations: READ,
    },
    wrap(async ({ include_completed, project, status, search, overdue_only }) => {
      let issues = await service.listMyIssues(include_completed ? 'all' : 'active');
      const has = (value, part) => value.toLowerCase().includes(part.trim().toLowerCase());
      if (project) issues = issues.filter((i) => has(i.projectName, project));
      if (status) issues = issues.filter((i) => i.status.name.toLowerCase() === status.trim().toLowerCase());
      if (search) issues = issues.filter((i) => has(i.key, search) || has(i.title, search));
      if (overdue_only) issues = issues.filter((i) => i.overdue);
      if (!issues.length) return text('No matching issues.');
      return text(`${issues.length} issue(s):\n${issues.map(issueLine).join('\n')}`);
    }),
  );

  server.registerTool(
    'get_issue',
    {
      title: 'Get issue details',
      description:
        'Full details of one issue: description, status and the statuses it can move to, priority, assignee, labels, dates, sub-issues, attachments, comments and recent activity.',
      inputSchema: { issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id') },
      annotations: READ,
    },
    wrap(async ({ issue }) => text(issueDetailText(await service.getIssue(await resolveIssueId(issue))))),
  );

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'Lists the FIST PMS projects the user can see.',
      inputSchema: { search: z.string().optional().describe('Only projects whose name contains this text') },
      annotations: READ,
    },
    wrap(async ({ search }) => {
      let projects = await service.listProjects();
      if (search) projects = projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
      return text(
        projects.length
          ? projects.map((p) => `- ${p.name} (${p.key}) · ${p.issueCount} issues`).join('\n')
          : 'No matching projects.',
      );
    }),
  );

  server.registerTool(
    'get_project_options',
    {
      title: 'Get project options',
      description: 'Statuses, assignable people and labels available when creating an issue in a project.',
      inputSchema: { project: z.string().describe('Project name (or part of it)') },
      annotations: READ,
    },
    wrap(async ({ project }) => {
      const p = await resolveProject(project);
      const o = await service.issueFormOptions(p.id);
      return text(
        [
          `Project: ${p.name}`,
          `Statuses: ${o.states.map((s) => s.name).join(', ')}`,
          `Priorities: ${o.priorities.join(', ')}`,
          `Assignees: ${o.assignees.map((a) => a.name).join(', ')}`,
          `Labels: ${o.labels.map((l) => l.name).join(', ') || 'none'}`,
        ].join('\n'),
      );
    }),
  );

  server.registerTool(
    'update_status',
    {
      title: 'Update issue status',
      description: 'Moves an issue to another status, e.g. "In Progress" or "Done". Status names differ per project.',
      inputSchema: {
        issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id'),
        status: z.string().describe('New status name'),
      },
      annotations: WRITE,
    },
    wrap(async ({ issue, status }) => {
      const id = await resolveIssueId(issue);
      const detail = await service.getIssue(id);
      const state = findByName(detail.states, status, 'status');
      if (state.name.toLowerCase() === detail.status.name.toLowerCase()) {
        return text(`${detail.key} is already ${detail.status.name}.`);
      }
      const result = await service.setStatus(id, state.id);
      listCache.at = 0;
      return text(`${detail.key} moved from ${detail.status.name} to ${result.name}.`);
    }),
  );

  server.registerTool(
    'update_priority',
    {
      title: 'Update issue priority',
      description: 'Changes the priority of an issue.',
      inputSchema: {
        issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id'),
        priority: z.enum(PRIORITIES),
      },
      annotations: WRITE,
    },
    wrap(async ({ issue, priority }) => {
      const d = await service.setPriority(await resolveIssueId(issue), priority);
      listCache.at = 0;
      return text(`${d.key} priority is now ${d.priority}.`);
    }),
  );

  server.registerTool(
    'assign_issue',
    {
      title: 'Assign issue',
      description: 'Changes who an issue is assigned to. Use "me" for the signed-in user or "unassigned" to clear it.',
      inputSchema: {
        issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id'),
        assignee: z.string().describe('Person name (or part of it), "me", or "unassigned"'),
      },
      annotations: WRITE,
    },
    wrap(async ({ issue, assignee }) => {
      const id = await resolveIssueId(issue);
      const detail = await service.getIssue(id);
      if (detail.assigneeLocked) return fail(`${detail.key} is closed; reopen it before changing the assignee.`);
      const person = isUnassign(assignee) ? null : await resolvePerson(detail.assignees, assignee);
      const d = await service.setAssignee(id, person?.id ?? '');
      listCache.at = 0;
      return text(`${d.key} is now assigned to ${d.assignee?.name ?? 'nobody'}.`);
    }),
  );

  server.registerTool(
    'add_comment',
    {
      title: 'Add comment',
      description: 'Adds a comment to an issue as the signed-in user.',
      inputSchema: {
        issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id'),
        comment: z.string().min(1).max(10_000),
      },
      annotations: WRITE,
    },
    wrap(async ({ issue, comment }) => {
      const d = await service.addComment(await resolveIssueId(issue), comment);
      return text(`Comment added to ${d.key}. It now has ${d.comments.length} comment(s).`);
    }),
  );

  server.registerTool(
    'create_issue',
    {
      title: 'Create issue',
      description:
        'Creates a new issue (or a sub-issue when parent_issue is given). Call get_project_options first if unsure which statuses, people or labels exist. File attachments are not supported.',
      inputSchema: {
        project: z.string().optional().describe('Project name. Not needed for sub-issues (the parent’s project is used).'),
        title: z.string().min(1).max(500),
        description: z.string().optional().describe('Plain text; new lines become paragraphs'),
        status: z.string().optional().describe("Status name; defaults to the project's first status"),
        priority: z.enum(PRIORITIES).optional(),
        assignee: z.string().optional().describe('Person name, "me", or "unassigned" (default)'),
        labels: z.array(z.string()).optional().describe('Label names'),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
        target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
        parent_issue: z.string().optional().describe('Key, link or id of the parent issue, to create a sub-issue'),
      },
      annotations: WRITE,
    },
    wrap(async (a) => {
      let projectId;
      let parentId = null;
      if (a.parent_issue) {
        parentId = await resolveIssueId(a.parent_issue);
        const parent = await service.getIssue(parentId);
        if (!parent.project) return fail('Could not tell which project the parent issue belongs to.');
        projectId = parent.project.id;
      } else if (a.project) {
        projectId = (await resolveProject(a.project)).id;
      } else {
        return fail('Say which project the issue belongs to (or give parent_issue for a sub-issue).');
      }

      const options = await service.issueFormOptions(projectId, parentId);
      const assignee = !a.assignee || isUnassign(a.assignee) ? null : await resolvePerson(options.assignees, a.assignee);
      const { id } = await service.createIssue(projectId, {
        name: a.title,
        description: a.description,
        stateId: a.status ? findByName(options.states, a.status, 'status').id : options.states[0]?.id,
        priority: a.priority,
        assigneeId: assignee?.id,
        labelIds: (a.labels ?? []).map((l) => findByName(options.labels, l, 'label').id),
        startDate: a.start_date,
        targetDate: a.target_date,
        parentId,
      });
      listCache.at = 0;
      if (!id) return text(`Created "${a.title}", but the PMS did not return its link.`);
      const created = await service.getIssue(id);
      return text(`Created ${created.key}: ${created.title}\n${issueUrl(id)}`);
    }),
  );

  const dateOrNone = z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('none')])
    .optional()
    .describe('YYYY-MM-DD, or "none" to clear');

  server.registerTool(
    'edit_issue',
    {
      title: 'Edit issue',
      description:
        'Edits the title, description, start/target dates or labels of an issue. Only the fields given are changed. ' +
        'A new description replaces the old one completely, so read the issue first (get_issue) when adding to it. ' +
        'Use update_status, update_priority and assign_issue for those fields. Attachments are not supported.',
      inputSchema: {
        issue: z.string().describe('Issue key like "BMS-1", or its PMS link or id'),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(50_000).optional().describe('Plain text; new lines become paragraphs'),
        description_html: z
          .string()
          .max(100_000)
          .optional()
          .describe(
            'Formatted description instead of plain text. Allowed: <p>, <h1>-<h3>, <strong>, <em>, <u>, <s>, <a href>, <ol>/<ul>/<li>, <blockquote>, <pre>. Other markup is removed.',
          ),
        start_date: dateOrNone,
        target_date: dateOrNone,
        add_labels: z.array(z.string()).optional().describe('Label names to add'),
        remove_labels: z.array(z.string()).optional().describe('Label names to remove'),
      },
      annotations: WRITE,
    },
    wrap(async (a) => {
      if (a.description !== undefined && a.description_html !== undefined) {
        return fail('Give either description or description_html, not both.');
      }
      const id = await resolveIssueId(a.issue);
      const current = await service.issueEditOptions(id);
      const patch = {};
      if (a.title !== undefined) patch.name = a.title;
      if (a.description !== undefined || a.description_html !== undefined) {
        if (/<(image-component|img)\b/i.test(current.descriptionHtml)) {
          return fail('This description contains images, which would be lost. Edit it in the PMS instead.');
        }
        if (a.description_html !== undefined) patch.descriptionHtml = a.description_html;
        else patch.description = a.description;
      }
      if (a.start_date !== undefined) patch.startDate = a.start_date === 'none' ? '' : a.start_date;
      if (a.target_date !== undefined) patch.targetDate = a.target_date === 'none' ? '' : a.target_date;
      if (a.add_labels?.length || a.remove_labels?.length) {
        const pick = (name) => findByName(current.labels, name, 'label').id;
        const remove = new Set((a.remove_labels ?? []).map(pick));
        patch.labelIds = [...new Set([...current.labelIds, ...(a.add_labels ?? []).map(pick)])].filter(
          (l) => !remove.has(l),
        );
      }
      if (!Object.keys(patch).length) return fail('Nothing to change: give at least one field to edit.');

      const d = await service.updateIssue(id, patch);
      listCache.at = 0;
      const changed = Object.keys(patch)
        .map((k) => ({ name: 'title', description: 'description', descriptionHtml: 'description', startDate: 'start date', targetDate: 'target date', labelIds: 'labels' })[k])
        .join(', ');
      return text(`Updated ${d.key} (${changed}).\n\n${issueDetailText(d)}`);
    }),
  );
}
