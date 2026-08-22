'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { previewHtml } = require('../src/preview');
const core = require('../src/codex-safe-core');

function ui(_zh, en, ...args) {
  return String(en).replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? `{${index}}`));
}

const root = path.join(__dirname, '..');
const expectedCoreCommit = 'e6e25b502aa35a079f660346785cf283fe293b6d';
assert.strictEqual(core.SAFE_CORE_VERSION, 3);
assert.strictEqual(core.SAFE_CONTRACT_VERSION, 2);
assert.strictEqual(core.POLICY_SCHEMA_VERSION, 3);
assert.strictEqual(core.REVIEW_RECEIPT_SCHEMA_VERSION, 3);
assert.strictEqual(core.COMMIT_RECEIPT_SCHEMA_VERSION, 3);
assert.strictEqual(require('../package.json').version, '3.0.0');
const stagedCore = execFileSync('git', ['ls-files', '--stage', 'src/codex-safe-core'], { cwd: root, encoding: 'utf8' }).trim();
assert.match(stagedCore, new RegExp(`^160000 ${expectedCoreCommit} 0\\tsrc/codex-safe-core$`), 'PR Safe must pin the final Core 3.0.1 commit');

for (const forbidden of ['bootstrap.js', 'src/core.js', 'src/extension-entry.js']) {
  assert.strictEqual(fs.existsSync(path.join(root, forbidden)), false, `${forbidden} is a forbidden transitional entry/proxy`);
}

const html = previewHtml(
  { cspSource: 'vscode-webview://test' },
  {
    title: 'Improve PR safety',
    body: 'Body',
    baseRef: 'origin/main',
    headBranch: 'feature/safe',
    headOid: 'a'.repeat(40),
    baseOid: 'b'.repeat(40),
    titleMaxLength: 88,
    maxBodyChars: 7000,
    localDirty: false,
    stale: true,
    canOpenGitHub: true,
    reviewEvidence: { status: 'unavailable' }
  },
  ui
);

assert.match(html, /const titleMaxLength = 88;/);
assert.doesNotMatch(html, /id="title" maxlength=/);
assert.match(html, /maxlength="7000"/);
assert.match(html, /Array\.from\(value\)\.length/);
assert.match(html, /vscode\.getState\(\)/);
assert.match(html, /vscode\.setState\(/);
assert.match(html, /style-src 'nonce-[a-f0-9]+'/);
assert.doesNotMatch(html, /unsafe-inline/);
assert.match(html, /HEAD, current branch, or base changed/);

const extension = fs.readFileSync(path.join(root, 'extension.js'), 'utf8');
assert.match(extension, /currentBranch/);
assert.match(extension, /a\.headBranch === b\.headBranch/);
assert.match(extension, /localResourceRoots:\s*\[\]/);
assert.doesNotMatch(extension, /retainContextWhenHidden/);
assert.match(extension, /validateEditedResult\(message\.title, message\.body, latest\)/);
assert.match(extension, /validateEditedResult\(state\.title, state\.body, state\)/);
assert.match(extension, /await ensureFreshResult\(latest\);\s*latest\.compareUrl/s);

console.log('Family v3 hardening and exact Core 3.0.1 pin tests passed.');
