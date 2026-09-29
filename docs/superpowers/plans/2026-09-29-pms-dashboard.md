# PMS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local React dashboard that lists "my issues" from FIST PMS and changes their status, talking to the PMS through a small Express server that reuses the user's browser session.

**Architecture:** Express server (`server/`) holds the PMS session cookie (captured by a Playwright login window), fetches PMS HTML pages, parses them with `node-html-parser`, and exposes a small JSON API on `127.0.0.1:3000`. React + Vite app (`web/`) calls that API. Spec: `docs/superpowers/specs/2026-09-29-pms-dashboard-design.md`.

**Tech Stack:** Node 24 (ESM), Express 5, node-html-parser, Playwright (Chromium), React 19, Vite, lucide-react, node:test.

## PMS page facts (observed 2026-09-29)

- `/my-issues?scope=active|all&size=100&page=N` (page is 0-based). Rows are `div.mi-item` containing `span.mi-key`, `a.mi-title[href="/issues/{uuid}?back=..."][title]`, `a.mi-proj[href="/projects/{uuid}"] > span.nm`, `span.mi-status > span.dot[style="background:#HEX"] + span{name}`, `span.pill > span:last-child{priority}`, `span.mi-target[.is-over] > span:last-child{date or "—"}`. Next page exists when an `a.pg-btn` with text "Next" is present. Filter form is `form[action="/my-issues"]`.
- Header: `span.topbar-account-name` holds the user's name.
- Issue page `/issues/{uuid}`: `form[action="/issues/{uuid}/state"]` with `input[name=_csrf]` and `select[name=stateId] > option[value=uuid](selected)`.
- Status change: `POST /issues/{uuid}/state` form-urlencoded `_csrf`, `stateId`, `back`; success is a 302.
- Expired session: 302 to `/oauth2/authorization/keycloak` or `auth.fistinnovations.com`.

## File map

| File | Responsibility |
|---|---|
| `package.json` | deps + scripts (`dev`, `build`, `start`, `test`) |
| `server/config.js` | constants (PMS base URL, data paths, port) |
| `server/parse.js` | pure HTML → data functions, `LayoutChangedError` |
| `server/session.js` | cookie persistence, Playwright login |
| `server/pms-client.js` | authenticated GET / form POST, `SessionExpiredError`, `PmsError` |
| `server/app.js` | Express routes + error mapping + static serving |
| `server/index.js` | starts server |
| `server/test/parse.test.js` + `server/test/fixtures/*.html` | parser tests on sanitized fixtures |
| `web/vite.config.js`, `web/index.html`, `web/src/main.jsx` | Vite + React bootstrap |
| `web/src/api.js` | JSON API wrapper, `ApiError` |
| `web/src/App.jsx` | state, data loading, layout |
| `web/src/components/*.jsx` | TopBar, Sidebar, Filters, IssueTable, IssueRow, StatusSelect, LoginBanner, Toast |
| `web/src/styles.css` | all styling |
| `README.md` | run instructions + security note |

---

### Task 1: Project scaffold

**Files:** Create `package.json`; `.gitignore` exists.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "pms-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k -n api,web -c magenta,cyan \"node --watch server/index.js\" \"vite web\"",
    "build": "vite build web",
    "start": "node server/index.js",
    "test": "node --test server/test/"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install express node-html-parser playwright` then `npm install -D vite @vitejs/plugin-react react react-dom lucide-react concurrently` then `npx playwright install chromium`.
Expected: installs without errors; Chromium downloaded.

- [ ] **Step 3: Commit** — `git add package.json package-lock.json && git commit -m "chore: scaffold project"`

### Task 2: HTML parser (TDD)

**Files:** Create `server/test/fixtures/my-issues.html`, `server/test/fixtures/my-issues-last.html`, `server/test/fixtures/issue.html`, `server/test/parse.test.js`, `server/parse.js`.

- [ ] **Step 1: Write sanitized fixtures** mirroring the structure in "PMS page facts" (fake names/titles, two rows on page 1 with a Next link, one row on the last page, one issue page with 3 states).
- [ ] **Step 2: Write failing tests** `server/test/parse.test.js` (code as committed): row fields, entity decoding in title, overdue flag, `targetDate: null` for "—", `hasNextPage` true/false, issue page csrf + states + selected, user name, `LayoutChangedError` on unrelated HTML for all three functions.
- [ ] **Step 3: Run** `npm test` — Expected: FAIL (`Cannot find module '../parse.js'`).
- [ ] **Step 4: Implement `server/parse.js`** exporting `LayoutChangedError`, `parseMyIssues(html) → { issues, hasNextPage }`, `parseIssuePage(html) → { csrf, states: [{ id, name, selected }] }`, `parseUserName(html) → string`.
- [ ] **Step 5: Run** `npm test` — Expected: all PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: parse PMS my-issues and issue pages"`

### Task 3: Session and PMS client

**Files:** Create `server/config.js`, `server/session.js`, `server/pms-client.js`.

- [ ] **Step 1: `server/config.js`** — `PMS_BASE = 'https://pms.fistinnovations.com'`, `DATA_DIR`, `COOKIE_FILE`, `PROFILE_DIR`, `PORT = 3000`.
- [ ] **Step 2: `server/session.js`** — `getCookie()`, `clearCookie()`, `login()` (single in-flight login; `chromium.launchPersistentContext(PROFILE_DIR, { headless: false })`, `page.goto(PMS_BASE)`, `waitForURL` until origin is PMS and path is not `/login*` or `/oauth2*`, 5 min timeout; read `JSESSIONID`; write `COOKIE_FILE`; close context).
- [ ] **Step 3: `server/pms-client.js`** — `SessionExpiredError`, `PmsError`, `isLoginRedirect(status, location)`, `get(path) → html`, `postForm(path, fields)`; all requests `redirect: 'manual'` with `Cookie: JSESSIONID=…`.
- [ ] **Step 4: Add test** for `isLoginRedirect` in `server/test/pms-client.test.js`; run `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: PMS session login and HTTP client"`

### Task 4: Express API

**Files:** Create `server/app.js`, `server/index.js`.

- [ ] **Step 1: Routes** — `GET /api/session`, `POST /api/login`, `POST /api/logout`, `GET /api/issues?scope=`, `GET /api/issues/:id/states?projectId=`, `POST /api/issues/:id/state` (validate UUIDs; validate `stateId` against the issue page; POST form; re-read and confirm selected state).
- [ ] **Step 2: Error mapping** — `SessionExpiredError` → 401 `session_expired`; `LayoutChangedError` → 502 `layout_changed`; login failure → 400 `login_failed`; other → 500 `server_error`.
- [ ] **Step 3: Static** — serve `web/dist` if built, SPA fallback for non-`/api` GETs.
- [ ] **Step 4: Smoke run** `npm start`, then `curl -s localhost:3000/api/session` — Expected: `{"loggedIn":false}` (before login).
- [ ] **Step 5: Commit** — `git commit -m "feat: local JSON API over PMS"`

### Task 5: React app

**Files:** Create everything under `web/`.

- [ ] **Step 1:** `web/vite.config.js` (react plugin, proxy `/api` → `http://127.0.0.1:3000`), `web/index.html`, `web/src/main.jsx`.
- [ ] **Step 2:** `web/src/api.js` — `ApiError(code, message)`, `api.session/login/logout/issues(scope)/states(issue)/setState(id, stateId)`.
- [ ] **Step 3:** Components: `TopBar`, `Sidebar`, `Filters`, `IssueTable` (with skeleton + empty state), `IssueRow`, `StatusSelect` (lazy-loaded states, per-project client cache, outside-click/Escape close), `LoginBanner`, `Toast` (auto-dismiss 3.5 s).
- [ ] **Step 4:** `App.jsx` — session check on mount, load issues when logged in and on scope change, client-side search/project/status filters, optimistic status change with revert + toast, session-expired → banner.
- [ ] **Step 5:** `styles.css` — lavender sidebar, white top bar, white card rows with soft shadow, hover lift + purple left border, status pills in PMS colors, priority pills, responsive under 900 px.
- [ ] **Step 6: Build** `npm run build` — Expected: `web/dist` produced, no errors.
- [ ] **Step 7: Commit** — `git commit -m "feat: React dashboard UI"`

### Task 6: README and end-to-end check

- [ ] **Step 1:** `README.md` — install, `npm run dev` / `npm start`, login flow, `data/` security warning.
- [ ] **Step 2:** Manual check: login window, list loads, search/filters, scope switch, status change on an issue the user picks, revert on error, session-expired banner after deleting `data/cookie.json`.
- [ ] **Step 3: Commit** — `git commit -m "docs: README"`
