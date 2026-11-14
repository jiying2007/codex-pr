'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { GitCli } = require('../src/git-cli');
const { resolveEffectiveConfig } = require('../src/policy');

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'change-git-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, timeout: 15000, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Git inventory fixture');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'initial\n');
  git('add', '--all');
  git('commit', '-qm', 'Initial fixture');
  return { root, git, cli: new GitCli(root) };
}

test('changedFiles consumes the real Git terminator exactly once', async t => {
  const { root, git, cli } = repository(t);
  fs.appendFileSync(path.join(root, 'tracked.txt'), 'changed\n');
  git('commit', '-qam', 'Change fixture');
  assert.deepEqual(await cli.changedFiles('HEAD~1..HEAD'), [{ status: 'M', path: 'tracked.txt' }]);
  assert.deepEqual(await cli.changedFiles('HEAD..HEAD'), []);
});

test('changedFiles preserves exact valid Git path bytes', async t => {
  const { root, git, cli } = repository(t);
  const paths = ['two words.txt', '\uFEFFbom.txt', 'unicode-\uFFFD.txt'];
  if (process.platform !== 'win32') paths.push(' space-at-edges ', 'tab\tname', 'line\nname\n', 'literal\\backslash');
  for (const name of paths) fs.writeFileSync(path.join(root, name), name);
  git('add', '--all');
  git('commit', '-qm', 'Add path fixtures');
  const changed = await cli.changedFiles('HEAD~1..HEAD');
  assert.deepEqual(new Set(changed.map(entry => entry.path)), new Set(paths));
  assert.ok(changed.every(entry => entry.status === 'A'));
});

test('changedFiles preserves both rename identities', async t => {
  const { git, cli } = repository(t);
  git('mv', 'tracked.txt', 'renamed.txt');
  git('commit', '-qm', 'Rename fixture');
  assert.deepEqual(await cli.changedFiles('HEAD~1..HEAD'), [{ status: 'R', path: 'renamed.txt', oldPath: 'tracked.txt' }]);
});

test('changedFiles rejects unsupported bytes instead of aliasing a UTF-8 path', { skip: process.platform !== 'linux' }, async t => {
  const { root, git, cli } = repository(t);
  fs.writeFileSync(Buffer.concat([Buffer.from(root + path.sep), Buffer.from([0xff])]), 'raw byte name\n');
  fs.writeFileSync(path.join(root, '\uFFFD'), 'replacement character name\n');
  git('add', '--all');
  git('commit', '-qm', 'Add distinct byte names');
  await assert.rejects(cli.changedFiles('HEAD~1..HEAD'), error => error.code === 'EGITOUTPUT' && /UTF-8/.test(error.message));
});

test('committed policy fingerprint binds the exact Git blob including trailing whitespace', async t => {
  const { root, git, cli } = repository(t);
  const text = JSON.stringify({ schemaVersion: 4, change: { requiredChecks: ['CI Gate'] } }) + '\n \t\n';
  fs.writeFileSync(path.join(root, '.codex-safe.json'), text);
  git('add', '--all');
  git('commit', '-qm', 'Commit policy fixture');
  const config = await resolveEffectiveConfig(cli, {}, 'HEAD');
  assert.equal(config.policyFingerprint, crypto.createHash('sha256').update(text).digest('hex'));
  assert.deepEqual(config.requiredChecks, ['CI Gate']);
});

test('committed policy rejects output beyond the Core 64 KiB read budget', async t => {
  const { root, git, cli } = repository(t);
  const text = JSON.stringify({ schemaVersion: 4, change: {} }) + ' '.repeat(64 * 1024);
  fs.writeFileSync(path.join(root, '.codex-safe.json'), text);
  git('add', '--all');
  git('commit', '-qm', 'Commit oversized policy fixture');
  await assert.rejects(resolveEffectiveConfig(cli, {}, 'HEAD'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
});
