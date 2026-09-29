# FIST PMS Dashboard + Claude extension

Two ways to work with FIST PMS (`pms.fistinnovations.com`) without its UI:

- **Dashboard** — a local web page listing your issues, with bulk status updates, an issue detail panel, and a create-issue form.
- **Claude extension** — lets Claude Desktop read and update your issues ("move BMS-2 to In Progress", "what's overdue?").

The PMS has no API, so both talk to it the way a browser does, using your own PMS login. Login happens in a real browser window (Microsoft Edge on Windows, Google Chrome on macOS); your password is never seen by this code.

## Claude Desktop extension (for anyone on the team)

Works on every Claude plan, including Free. Requires the Claude Desktop app (not claude.ai in a browser).

1. Get `fist-pms.mcpb` (build it with `npm run build:extension`, output in `dist/`).
2. In Claude Desktop: **Settings → Extensions → Advanced settings → Install Extension…** and pick the file.
3. Ask Claude something like "list my PMS issues". The first time, a sign-in window opens — sign in to FIST as usual.

Tools: `check_login`, `list_my_issues`, `get_issue`, `list_projects`, `get_project_options`, `update_status`, `update_priority`, `assign_issue`, `add_comment`, `create_issue` (no file attachments). Claude Desktop asks before running tools that change data.

Issues are referred to by key (`BMS-1`). Keys can only be looked up among **your** issues; for others, give Claude the PMS link.

## Dashboard

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000. For development with hot reload: `npm run dev` (http://localhost:5173).

## Login data and security

- The PMS session is saved in `~/.fist-pms-dashboard` (`cookie.json` plus a dedicated browser profile). The dashboard and the Claude extension share it. **Anyone with this folder can act as you in the PMS until the session ends** — don't share or sync it. Delete the folder to sign out everywhere.
- PMS sessions time out when idle; they are renewed silently from the saved browser profile, and a sign-in window opens only when that fails.
- The dashboard server listens on `127.0.0.1` only.
- Comments and descriptions from the PMS are sanitized (DOMPurify) before the dashboard displays them.

## Project layout

| Path | What |
|---|---|
| `server/service.js` | All PMS operations with validation (shared by dashboard and extension) |
| `server/parse.js` | PMS HTML → data |
| `server/pms-client.js`, `server/session.js` | HTTP with the session cookie; browser login |
| `server/app.js` | Dashboard HTTP API |
| `mcp/` | Claude MCP server and tools |
| `web/` | React dashboard |
| `extension/manifest.json`, `scripts/build-extension.mjs` | Claude Desktop extension packaging |

Tests: `npm test`.

If the PMS changes its page layout, parsing fails with a "PMS page layout changed" message; update `server/parse.js` and the fixtures in `server/test/fixtures/`.
