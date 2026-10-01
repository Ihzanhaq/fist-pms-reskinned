// HTTP API for the React dashboard. All PMS logic lives in service.js.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import express from 'express';
import multer from 'multer';
import { ROOT_DIR, WEB_DIST_DIR } from './config.js';
import { LayoutChangedError } from './parse.js';
import { SessionExpiredError } from './pms-client.js';
import * as insights from './insights.js';
import { leaderboard } from './leaderboard.js';
import * as updates from './updates.js';
import * as service from './service.js';
import { BadRequestError } from './service.js';

const MAX_FILES = 10;
const MAX_FILE_MB = 25;

// Files are held in memory only long enough to forward them to the PMS.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_MB * 1024 * 1024 },
  defParamCharset: 'utf8', // keep non-ASCII file names intact
});

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/session', async (req, res) => {
    const info = await service.sessionInfo();
    // The user id only drives the top-bar photo, so a failed lookup is not an error.
    if (info.loggedIn) info.userId = await insights.myActorId().catch(() => null);
    res.json(info);
  });
  app.get('/api/updates', async (req, res) => res.json(await updates.status()));
  app.post('/api/updates/apply', async (req, res) => res.json(await updates.apply()));
  app.get('/api/browsers', (req, res) => res.json(service.browsers()));
  app.post('/api/login', async (req, res) => {
    const info = await service.login(req.body?.browser);
    if (info.loggedIn) info.userId = await insights.myActorId().catch(() => null);
    res.json(info);
  });
  app.post('/api/logout', (req, res) => res.json(service.logout()));

  app.get('/api/dashboard', async (req, res) => res.json(await insights.dashboard(req.query.days)));
  app.get('/api/leaderboard', async (req, res) =>
    res.json(await leaderboard({ period: req.query.period || 'week', projectId: req.query.project || null })),
  );
  app.get('/api/report', async (req, res) => res.json(await insights.dailyReport(req.query.date || undefined)));

  app.get('/api/issues', async (req, res) => res.json({ issues: await service.listMyIssues(req.query.scope) }));

  app.get('/api/issues/:id', async (req, res) => res.json(await service.getIssue(req.params.id)));

  app.get('/api/issues/:id/states', async (req, res) =>
    res.json({ states: await service.statesFor(req.params.id, req.query.projectId) }),
  );

  app.post('/api/issues/:id/state', async (req, res) =>
    res.json({ status: await service.setStatus(req.params.id, req.body?.stateId) }),
  );

  app.post('/api/issues/:id/comment', async (req, res) =>
    res.json(await service.addComment(req.params.id, req.body?.body)),
  );

  app.post('/api/issues/:id/priority', async (req, res) =>
    res.json(await service.setPriority(req.params.id, req.body?.priority)),
  );

  app.post('/api/issues/:id/assignee', async (req, res) =>
    res.json(await service.setAssignee(req.params.id, req.body?.userId)),
  );

  // Streams an attachment through the server so the user's browser needs no PMS login.
  app.get('/api/attachments/:id', async (req, res) => {
    const upstream = await service.attachment(req.params.id, Boolean(req.query.dl));
    for (const header of ['content-type', 'content-length', 'content-disposition']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    Readable.fromWeb(upstream.body).pipe(res);
  });

  // Profile photos, fetched with the PMS login. Browsers keep a photo for 10 minutes and never keep "no photo".
  app.get('/api/avatars/:id', async (req, res) => {
    const image = await service.avatar(req.params.id);
    if (!image) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Content-Type', image.type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.body);
  });

  app.get('/api/projects', async (req, res) => res.json({ projects: await service.listProjects() }));

  app.post('/api/projects/:id/pin', async (req, res) => res.json(await service.setPinned(req.params.id, req.body?.pinned)));

  // Project cover images, fetched with the PMS login and kept by the browser for 10 minutes.
  app.get('/api/project-covers/:id', async (req, res) => {
    const image = await service.projectCover(req.params.id);
    if (!image) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('Content-Type', image.type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.body);
  });

  app.get('/api/projects/:id/issues', async (req, res) => res.json(await service.projectIssues(req.params.id)));

  app.get('/api/projects/:id/issue-form', async (req, res) =>
    res.json(await service.issueFormOptions(req.params.id, req.query.parentId || null)),
  );

  // Multipart: a `data` field with the issue as JSON, plus optional `files`.
  app.post('/api/projects/:id/issues', upload.array('files', MAX_FILES), async (req, res) => {
    let input;
    try {
      input = req.is('multipart/form-data') ? JSON.parse(req.body.data ?? '{}') : (req.body ?? {});
    } catch {
      throw new BadRequestError('bad_request', 'Invalid issue data');
    }
    res.status(201).json(await service.createIssue(req.params.id, input, req.files ?? []));
  });

  // The Claude Desktop extension, built by npm run build:extension.
  app.get('/api/extension', (req, res) => {
    const file = path.join(ROOT_DIR, 'dist', 'fist-pms.mcpb');
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'not_found', message: 'Run npm run build:extension first' });
    }
    res.download(file, 'fist-pms.mcpb');
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
