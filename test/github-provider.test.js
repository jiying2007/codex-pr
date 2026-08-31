'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GitHubProvider, requiredChecksFromRules } = require('../src/providers/github');

function provider() {
  return new GitHubProvider({
    remote: { owner: 'o', projectPath: 'o/r' },
    apiBaseUrl: 'https://api.github.com',
    token: 'x', timeoutMs: 1000, allowInsecureHttp: false
  });
}

test('GitHub active rulesets contribute required status checks', async () => {
  assert.deepEqual(requiredChecksFromRules([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'build' }, { context: 'lint' }] } }]), ['build', 'lint']);
  const p = provider();
  p.client.request = async (_m, path) => path.includes('/protection/')
    ? { status: 404, data: null }
    : { status: 200, data: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'build' }] } }] };
  p.client.paginate = async () => ({ complete: true, items: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'build' }] } }] });
  assert.deepEqual(await p.getRequiredCheckNames('main'), { status: 'available', names: ['build'] });
});

test('GitHub required-check discovery fails closed when one enforcement surface is unreadable', async () => {
  const p = provider();
  p.client.request = async (_m, path) => path.includes('/protection/')
    ? { status: 200, data: { contexts: ['classic'] } }
    : { status: 403, data: null };
  assert.deepEqual(await p.getRequiredCheckNames('main'), { status: 'unknown', names: ['classic'] });
});
