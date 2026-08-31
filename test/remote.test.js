'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseRemote, detectProvider } = require('../src/remote');
test('parses GitHub SSH and GitLab nested project remotes', () => {
  const gh = parseRemote('git@github.com:jiying2007/codex-pr.git'); assert.equal(gh.host, 'github.com'); assert.equal(gh.projectPath, 'jiying2007/codex-pr'); assert.equal(detectProvider(gh, {}), 'github');
  const gl = parseRemote('ssh://git@gitlab.example.local/group/sub/project.git'); assert.equal(gl.projectPath, 'group/sub/project'); assert.equal(detectProvider(gl, { provider: 'gitlab' }), 'gitlab');
});
test('custom host fails closed without explicit provider', () => { const r = parseRemote('git@scm.example.local:team/repo.git'); assert.throws(() => detectProvider(r, {}), { code: 'EPROVIDERUNKNOWN' }); });
test('custom provider can be inferred from configured API host', () => { const r = parseRemote('git@scm.example.local:team/repo.git'); assert.equal(detectProvider(r, { gitlabApiBaseUrl: 'https://scm.example.local/api/v4' }), 'gitlab'); });
