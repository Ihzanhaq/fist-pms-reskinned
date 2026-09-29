import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import express from 'express';
import multer from 'multer';
import { WEB_DIST_DIR } from './config.js';
import {
  LayoutChangedError,
  parseIssueDetail,
  parseIssueForm,
  parseIssuePage,
  parseMyIssues,
  parseProjects,
  parseUserName,
} from './parse.js';
import * as pms from './pms-client.js';
import { SessionExpiredError } from './pms-client.js';
import * as session from './session.js';
import { textToHtml } from './text-to-html.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGES = 50;
const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const MAX_FILES = 10;
const MAX_FILE_MB = 25;

// Files are held in memory only long enough to forward them to the PMS.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_MB * 1024 * 1024 },
  defParamCharset: 'utf8', // keep non-ASCII file names intact
});

class BadRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function requireUuid(value, what) {
  if (!UUID.test(value ?? '')) throw new BadRequestError('bad_request', `Invalid ${what}`);
  return value;
}

async function currentUserName() {
  return parseUserName(await pms.get('/my-issues?size=1'));
}

export function createApp() {
  const app = express();
  app.use(express.json());

  // Status lists are per project; they rarely change, so keep them for the server's lifetime.
  const statesByProject = new Map();

  app.get('/api/session', async (req, res) => {
    try {
      res.json({ loggedIn: true, userName: await currentUserName() });
    } catch (err) {
      if (err instanceof SessionExpiredError) return res.json({ loggedIn: false });
      throw err;
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      await session.login();
    } catch (err) {
      throw new BadRequestError('login_failed', err.message);
    }
    res.json({ loggedIn: true, userName: await currentUserName() });
  });

  app.post('/api/logout', (req, res) => {
    session.clearCookie();
    res.json({ loggedIn: false });
  });

  app.get('/api/issues', async (req, res) => {
    const scope = req.query.scope === 'all' ? 'all' : 'active';
    const issues = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const html = await pms.get(`/my-issues?scope=${scope}&sort=default&size=100&page=${page}`);
      const result = parseMyIssues(html);
      issues.push(...result.issues);
      if (!result.hasNextPage) break;
    }
    res.json({ issues });
  });

  app.get('/api/issues/:id/states', async (req, res) => {
    const id = requireUuid(req.params.id, 'issue id');
    const projectId = UUID.test(req.query.projectId ?? '') ? req.query.projectId : null;
    if (projectId && statesByProject.has(projectId)) {
      return res.json({ states: statesByProject.get(projectId) });
    }
    const { states } = parseIssuePage(await pms.get(`/issues/${id}`));
    const list = states.map(({ id, name }) => ({ id, name }));
    if (projectId) statesByProject.set(projectId, list);
    res.json({ states: list });
  });

  app.post('/api/issues/:id/state', async (req, res) => {
    const id = requireUuid(req.params.id, 'issue id');
    const stateId = requireUuid(req.body?.stateId, 'status id');

    // Fresh page gives a valid CSRF token and the statuses allowed for this issue.
    const before = parseIssuePage(await pms.get(`/issues/${id}`));
    if (!before.states.some((s) => s.id === stateId)) {
      throw new BadRequestError('invalid_state', 'That status is not available for this issue');
    }
    await pms.postForm(`/issues/${id}/state`, { _csrf: before.csrf, stateId, back: '/my-issues' });

    const after = parseIssuePage(await pms.get(`/issues/${id}`));
    const selected = after.states.find((s) => s.selected);
    if (selected?.id !== stateId) throw new pms.PmsError('The PMS did not apply the status change');
    res.json({ status: { id: selected.id, name: selected.name } });
  });

  // ---------- issue detail ----------

  const loadDetail = async (id) => ({ id, ...parseIssueDetail(await pms.get(`/issues/${id}`)) });

  app.get('/api/issues/:id', async (req, res) => {
    res.json(await loadDetail(requireUuid(req.params.id, 'issue id')));
  });

  app.post('/api/issues/:id/comment', async (req, res) => {
    const id = requireUuid(req.params.id, 'issue id');
    const body = String(req.body?.body ?? '').trim();
    if (!body) throw new BadRequestError('bad_request', 'Comment is empty');
    if (body.length > 10_000) throw new BadRequestError('bad_request', 'Comment is too long');
    const { csrf } = parseIssuePage(await pms.get(`/issues/${id}`));
    await pms.postForm(`/issues/${id}/comment`, { _csrf: csrf, body });
    res.json(await loadDetail(id));
  });

  app.post('/api/issues/:id/priority', async (req, res) => {
    const id = requireUuid(req.params.id, 'issue id');
    const priority = req.body?.priority;
    if (!PRIORITIES.includes(priority)) throw new BadRequestError('bad_request', 'Invalid priority');
    const { csrf } = parseIssuePage(await pms.get(`/issues/${id}`));
    await pms.postForm(`/issues/${id}/priority`, { _csrf: csrf, priority, back: `/issues/${id}` });
    res.json(await loadDetail(id));
  });

  app.post('/api/issues/:id/assignee', async (req, res) => {
    const id = requireUuid(req.params.id, 'issue id');
    const userId = req.body?.userId ?? '';
    const page = await pms.get(`/issues/${id}`);
    const detail = parseIssueDetail(page);
    if (detail.assigneeLocked) throw new BadRequestError('assignee_locked', "Reopen this issue to change who it's assigned to");
    if (userId && !detail.assignees.some((a) => a.id === userId)) {
      throw new BadRequestError('bad_request', 'That person cannot be assigned to this issue');
    }
    const { csrf } = parseIssuePage(page);
    await pms.postForm(`/issues/${id}/assignee`, { _csrf: csrf, userId, back: `/issues/${id}` });
    res.json(await loadDetail(id));
  });

  // Streams an attachment through the server so the user's browser needs no PMS login.
  app.get('/api/attachments/:id', async (req, res) => {
    const id = requireUuid(req.params.id, 'attachment id');
    const upstream = await pms.getRaw(`/issue-attachment/${id}${req.query.dl ? '?dl=1' : ''}`);
    for (const header of ['content-type', 'content-length', 'content-disposition']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    Readable.fromWeb(upstream.body).pipe(res);
  });

  // ---------- projects & create issue ----------

  app.get('/api/projects', async (req, res) => {
    res.json({ projects: parseProjects(await pms.get('/')) });
  });

  const newIssuePath = (projectId, parentId) =>
    `/projects/${projectId}/issues/new${parentId ? `?parent=${parentId}` : ''}`;

  app.get('/api/projects/:id/issue-form', async (req, res) => {
    const projectId = requireUuid(req.params.id, 'project id');
    const parentId = req.query.parentId ? requireUuid(req.query.parentId, 'parent issue id') : null;
    const { csrf, action, ...form } = parseIssueForm(await pms.get(newIssuePath(projectId, parentId)));
    res.json(form);
  });

  // Multipart: a `data` field with the issue as JSON, plus optional `files`.
  app.post('/api/projects/:id/issues', upload.array('files', MAX_FILES), async (req, res) => {
    const projectId = requireUuid(req.params.id, 'project id');
    let input;
    try {
      input = req.is('multipart/form-data') ? JSON.parse(req.body.data ?? '{}') : (req.body ?? {});
    } catch {
      throw new BadRequestError('bad_request', 'Invalid issue data');
    }
    const parentId = input.parentId ? requireUuid(input.parentId, 'parent issue id') : null;
    const form = parseIssueForm(await pms.get(newIssuePath(projectId, parentId)));

    const name = String(input.name ?? '').trim();
    if (!name) throw new BadRequestError('bad_request', 'Title is required');
    if (name.length > 500) throw new BadRequestError('bad_request', 'Title is too long');
    const oneOf = (value, list, what) => {
      if (value && !list.some((x) => x.id === value)) throw new BadRequestError('bad_request', `Invalid ${what}`);
      return value || '';
    };
    const date = (value, what) => {
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestError('bad_request', `Invalid ${what}`);
      return value || '';
    };
    const priority = input.priority || 'none';
    if (!PRIORITIES.includes(priority)) throw new BadRequestError('bad_request', 'Invalid priority');
    const labelIds = Array.isArray(input.labelIds) ? input.labelIds : [];
    labelIds.forEach((l) => oneOf(l, form.labels, 'label'));

    const data = new FormData();
    data.append('_csrf', form.csrf);
    if (form.parentId) data.append('parentId', form.parentId);
    data.append('name', name);
    data.append('descriptionHtml', textToHtml(input.description));
    data.append('stateId', oneOf(input.stateId, form.states, 'status'));
    data.append('priority', priority);
    data.append('startDate', date(input.startDate, 'start date'));
    data.append('targetDate', date(input.targetDate, 'target date'));
    data.append('assigneeId', oneOf(input.assigneeId, form.assignees, 'assignee'));
    for (const labelId of labelIds) data.append('labelIds', labelId);
    for (const file of req.files ?? []) {
      data.append('files', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    }

    let location;
    try {
      location = await pms.postMultipart(form.action, data);
    } catch (err) {
      if (err instanceof pms.PmsError && req.files?.length) {
        throw new pms.PmsError(`${err.message}. The PMS may not accept files this large.`);
      }
      throw err;
    }
    const id = location.match(/\/issues\/([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!id && location.includes('/issues/new')) throw new pms.PmsError('The PMS did not accept the new issue');
    res.status(201).json({ id });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  if (fs.existsSync(WEB_DIST_DIR)) {
    app.use(express.static(WEB_DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(WEB_DIST_DIR, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    if (err instanceof SessionExpiredError) return res.status(401).json({ error: 'session_expired' });
    if (err instanceof multer.MulterError) {
      const message = {
        LIMIT_FILE_SIZE: `Each file must be under ${MAX_FILE_MB} MB`,
        LIMIT_FILE_COUNT: `You can attach up to ${MAX_FILES} files`,
      }[err.code];
      return res.status(400).json({ error: 'bad_request', message: message ?? err.message });
    }
    if (err instanceof BadRequestError) return res.status(400).json({ error: err.code, message: err.message });
    if (err instanceof LayoutChangedError) {
      return res.status(502).json({ error: 'layout_changed', message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error', message: err.message });
  });

  return app;
}
