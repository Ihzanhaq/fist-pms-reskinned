# PMS Dashboard — Design

Date: 2026-09-29

## Goal

A local dashboard to see "my issues" from FIST PMS (`https://pms.fistinnovations.com`) and change their status quickly, with a cleaner UI than the PMS itself.

FIST PMS has no JSON API. It is a server-rendered Spring MVC app behind Keycloak SSO. Every read is an HTML page and every write is an HTML form POST protected by a Spring Security `_csrf` token. The dashboard therefore talks to the PMS the same way a browser does: authenticated with the user's session cookie, reading HTML and posting forms.

## Scope (v1)

In:
- List all issues from `/my-issues` (key, title, project, status, priority, target date).
- Search (key or title) and filter by project, status, and active/all.
- Change an issue's status.
- Open an issue in the PMS by clicking its title.
- Login via Playwright window; detect expired session.

Out (possible later): priority changes, comments, creating issues, attachments, notifications.

## Architecture

```
pms-dashboard/
  server/                 Node 24, Express, ESM
    session.js            Playwright login window; cookie + profile persistence
    pms-client.js         HTTP to PMS with cookie; session-expiry detection; CSRF
    parse.js              HTML -> data (node-html-parser)
    app.js                Express routes (/api/*), serves web/dist in production
    index.js              Entry point; binds 127.0.0.1:3000
    test/                 node:test parser tests + sanitized HTML fixtures
  web/                    React 19 + Vite
    src/
      main.jsx
      App.jsx             Layout: sidebar, top bar, page
      api.js              fetch wrappers for /api/*
      components/
        Sidebar.jsx
        TopBar.jsx
        Filters.jsx       search box + Project / Status / Scope dropdowns
        IssueTable.jsx
        IssueRow.jsx
        StatusSelect.jsx  colored pill; becomes dropdown on click
        LoginBanner.jsx   "Session expired, log in again"
        Toast.jsx
      styles.css          plain CSS with CSS variables (no UI framework)
  data/                   gitignored: cookie.json, browser-profile/
  package.json            root scripts: dev, build, start, test
```

Dev: `npm run dev` runs Express (port 3000) and Vite (port 5173) together via `concurrently`; Vite proxies `/api` to Express. Prod-like: `npm run build` then `npm start` serves the built React app from Express on `http://localhost:3000`.

### Unit responsibilities

- **session.js** — `getCookie()`, `saveCookie()`, `login()`. `login()` launches Chromium through `launchPersistentContext('data/browser-profile', { headless: false })`, opens the PMS, waits (up to 5 minutes) for the URL to be back on `pms.fistinnovations.com` and not an auth page, reads the `JSESSIONID` cookie, saves it to `data/cookie.json`, closes the window. Because the profile is persistent, the Keycloak SSO cookie usually survives, so re-login is often automatic.
- **pms-client.js** — `get(path)` and `postForm(path, fields)`. Sends `Cookie: JSESSIONID=...`, `redirect: 'manual'`. A redirect to `/oauth2/authorization/keycloak` or to `auth.fistinnovations.com` throws `SessionExpiredError`. No cookie at all also throws `SessionExpiredError`.
- **parse.js** — pure functions, no I/O:
  - `parseMyIssues(html)` → `{ issues: [{ id, key, title, projectId, projectName, status: { name, color }, priority, targetDate }], hasNextPage }`. Reads `.mi-item` rows.
  - `parseIssuePage(html)` → `{ csrf, states: [{ id, name, selected }] }`. Reads `form[action$="/state"]`.
  - `parseUserName(html)` → display name from the header.
  - If the expected elements are missing, throws `LayoutChangedError`.
- **app.js** — routes below; maps `SessionExpiredError` → 401 `{ error: 'session_expired' }`, `LayoutChangedError` → 502 `{ error: 'layout_changed' }`, other → 500.

## Local API

| Method | Path | Result |
|---|---|---|
| GET | `/api/session` | `{ loggedIn, userName }` |
| POST | `/api/login` | opens login window; resolves when done → `{ loggedIn: true, userName }` |
| GET | `/api/issues?scope=active\|all` | my issues: fetches `/my-issues?scope=<scope>&size=100&page=N` until no next page. The PMS decides what "active" means, so changing Scope refetches |
| GET | `/api/issues/:id/states` | status options for the issue's project; cached in memory per project id |
| POST | `/api/issues/:id/state` body `{ stateId }` | changes status; returns updated `{ status }` |

Search, Project and Status filters run client-side over the loaded list. Scope is server-side (see above).

## Status change flow

1. User picks a status in `StatusSelect`; the row updates at once (optimistic).
2. Server `GET /issues/{id}` → `parseIssuePage` gives a fresh `_csrf` and valid state ids; rejects a `stateId` not in the list (400).
3. Server `POST /issues/{id}/state` with `_csrf`, `stateId`, `back=/my-issues` (form-urlencoded).
4. Success = 302 redirect back into the PMS (not to login). Server re-reads the issue page and returns the now-selected state.
5. UI shows toast "Status updated". On any error the row reverts and a toast shows the reason.

Status colors: the list page gives each status's color. For options not yet seen in the list, fall back to neutral grey.

## UI

Based on the user's reference image (lavender sidebar, white card rows, soft shadows):

- **Sidebar** (left, lavender `#8e82c9`-ish, white text): app name "FIST PMS", nav item "My Issues" (active), "Log out" at bottom (clears local cookie only).
- **Top bar** (white): user's PMS name, refresh button.
- **Page**: title "My Issues" with a count; filter row: search input with icon, then dropdowns Project, Status, Scope (Active / All; default Active).
- **Table**: header row in muted small text; each issue is a white rounded card row with Key (mono badge), Title (link to PMS), Project, Priority pill, Target date, Status pill. Hover lifts the row (stronger shadow) and shows a 3px purple left border.
- **StatusSelect**: pill in the status color; click opens a dropdown of that project's statuses (fetched on first open, spinner while loading).
- **States**: skeleton rows while loading; empty state "No issues match these filters"; `LoginBanner` with "Log in" button when session expired or missing; "PMS page layout changed" error card if parsing fails.
- Font: Inter (system fallback). No UI component library.

## Security

- Server binds to `127.0.0.1` only.
- `data/` (cookie + browser profile) is gitignored; README warns it is equivalent to a logged-in session.
- Password is never seen by the app; login happens in the real Keycloak page.
- Fixtures in `server/test/` are sanitized (names/titles replaced) before commit.

## Testing

- `node --test server/test` — parser tests against sanitized fixtures of `/my-issues` and an issue page, plus a "layout changed" case.
- Manual check in the browser: login, list, filters, status change on one issue the user picks as safe to change, session-expired banner.

## Risks

- PMS HTML changes break parsing → surfaced as `layout_changed`, fixed by updating `parse.js` + fixtures.
- Unofficial usage of the PMS — user to confirm with PMS owners.
