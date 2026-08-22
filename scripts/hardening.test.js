'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { previewHtml } = require('../src/preview');
const core = require('../src/codex-safe-core');
const pkg = require('../package.json');

function ui(_zh, en, ...args) {
  return String(en).replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? `{${index}}`));
}

const root = path.join(__dirname, '..');
const expectedCoreCommit = '4dc4de836625a8b70084531eb3321734eca675d0';
assert.strictEqual(core.SAFE_CORE_VERSION, 4);
assert.strictEqual(core.SAFE_CONTRACT_VERSION, 2);
assert.strictEqual(core.POLICY_SCHEMA_VERSION, 3);
assert.strictEqual(core.REVIEW_RECEIPT_SCHEMA_VERSION, 4);
assert.strictEqual(core.COMMIT_RECEIPT_SCHEMA_VERSION, 4);
assert.strictEqual(core.PR_PROMPT_CONTRACT_VERSION, 1);
assert.strictEqual(pkg.version, '4.0.0');
const stagedCore = execFileSync('git', ['ls-files', '--stage', 'src/codex-safe-core'], { cwd: root, encoding: 'utf8' }).trim();
assert.match(stagedCore, new RegExp(`^160000 ${expectedCoreCommit} 0\\tsrc/codex-safe-core$`), 'PR Safe must pin the final Safe Core 4.0.0 main commit');

for (const forbidden of ['bootstrap.js', 'src/core.js', 'src/extension-entry.js']) {
  assert.strictEqual(fs.existsSync(path.join(root, forbidden)), false, `${forbidden} is a forbidden transitional entry/proxy`);
}

const html = previewHtml(
  { cspSource: 'vscode-webview://test' },
  {
    title: 'Improve PR safety', body: 'Body', baseRef: 'origin/main', headBranch: 'feature/safe',
    headOid: 'a'.repeat(40), baseOid: 'b'.repeat(40), titleMaxLength: 88, maxBodyChars: 7000,
    localDirty: false, stale: true, canOpenGitHub: true, reviewEvidence: { status: 'unavailable' }
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

assert.strictEqual(pkg.capabilities?.untrustedWorkspaces?.supported, false);
assert.strictEqual(pkg.capabilities?.virtualWorkspaces?.supported, false);
const scmGenerate = (pkg.contributes?.menus?.['scm/title'] || []).find(item => item.command === 'safeCodexPr.generate');
assert.match(String(scmGenerate?.when || ''), /isWorkspaceTrusted/, 'SCM PR generation must require workspace trust');
for (const command of ['safeCodexPr.generate', 'safeCodexPr.regenerate', 'safeCodexPr.selectBase', 'safeCodexPr.openPullRequest', 'safeCodexPr.checkEnvironment']) {
  const item = (pkg.contributes?.menus?.commandPalette || []).find(entry => entry.command === command);
  if (item) assert.match(String(item.when || ''), /isWorkspaceTrusted/, `${command} must require workspace trust`);
}

const release = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
assert.match(release, /SBOM\.spdx\.json/);
assert.match(release, /Attest immutable release provenance/);
assert.match(release, /immutable assets will not be overwritten/);
assert.doesNotMatch(release, /--clobber/);
assert.doesNotMatch(release, /tags:\s*\[/);

console.log('Family v4 hardening, workspace trust, exact Safe Core 4.0.0 pin and immutable release tests passed.');
