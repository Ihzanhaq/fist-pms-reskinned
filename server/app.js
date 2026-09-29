import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { WEB_DIST_DIR } from './config.js';
import { LayoutChangedError, parseIssuePage, parseMyIssues, parseUserName } from './parse.js';
import * as pms from './pms-client.js';
import { SessionExpiredError } from './pms-client.js';
import * as session from './session.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGES = 50;

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
    if (err instanceof BadRequestError) return res.status(400).json({ error: err.code, message: err.message });
    if (err instanceof LayoutChangedError) {
      return res.status(502).json({ error: 'layout_changed', message: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'server_error', message: err.message });
  });

  return app;
}
