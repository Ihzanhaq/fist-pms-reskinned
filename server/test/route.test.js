import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_ROUTE, parseRoute, routeToPath } from '../../web/src/route.js';

const loc = (pathname, search = '') => ({ pathname, search: search ? `?${search}` : '' });

describe('parseRoute / routeToPath', () => {
  it('round-trips dashboard and issues', () => {
    for (const pathname of ['/', '/issues', '/my-projects', '/projects', '/settings', '/claude', '/leaderboard']) {
      const route = parseRoute(loc(pathname));
      assert.equal(routeToPath(route), pathname);
    }
  });

  it('keeps project detail and issue drawer', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const issue = '11111111-2222-3333-4444-555555555555';
    const route = parseRoute(loc(`/my-projects/${id}`, `issue=${issue}&q=bug&layout=board`));
    assert.equal(route.view, 'my-projects');
    assert.equal(route.projectId, id);
    assert.equal(route.issueId, issue);
    assert.equal(route.q, 'bug');
    assert.equal(route.layout, 'board');
    assert.equal(routeToPath(route), `/my-projects/${id}?q=bug&layout=board&issue=${issue}`);
  });

  it('keeps report date and issues filters', () => {
    const route = parseRoute(loc('/report', 'date=2025-09-15'));
    assert.equal(route.view, 'report');
    assert.equal(route.date, '2025-09-15');
    assert.equal(routeToPath(route), '/report?date=2025-09-15');

    const issues = parseRoute(loc('/issues', 'scope=all&q=tra&project=TRAVERP&status=Done&layout=board'));
    assert.equal(issues.scope, 'all');
    assert.equal(issues.filterProject, 'TRAVERP');
    assert.equal(routeToPath(issues), '/issues?scope=all&q=tra&project=TRAVERP&status=Done&layout=board');
  });

  it('omits default query params', () => {
    assert.equal(routeToPath({ ...DEFAULT_ROUTE, view: 'issues' }), '/issues');
    assert.equal(routeToPath({ ...DEFAULT_ROUTE, view: 'dashboard' }), '/');
  });
});
