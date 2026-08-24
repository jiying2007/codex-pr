'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { previewHtml } = require('../src/preview');
const core = require('../src/codex-safe-core');
const pkg = require('../package.json');

function ui(_zh, en, ...args) { return String(en).replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? `{${index}}`)); }

const root = path.join(__dirname, '..');
const expectedCoreCommit = '7ffbf6f1791e17ba74faf0922e7a702bdac72059';
assert.strictEqual(core.SAFE_CORE_VERSION, 4);
assert.strictEqual(core.SAFE_CONTRACT_VERSION, 2);
assert.strictEqual(core.POLICY_SCHEMA_VERSION, 3);
assert.strictEqual(core.REVIEW_RECEIPT_SCHEMA_VERSION, 4);
assert.strictEqual(core.COMMIT_RECEIPT_SCHEMA_VERSION, 4);
assert.strictEqual(core.PR_PROMPT_CONTRACT_VERSION, 1);
assert.strictEqual(pkg.version, '4.0.1');
const stagedCore = execFileSync('git', ['ls-files', '--stage', 'src/codex-safe-core'], { cwd: root, encoding: 'utf8' }).trim();
assert.match(stagedCore, new RegExp(`^160000 ${expectedCoreCommit} 0\\tsrc/codex-safe-core$`), 'PR Safe must pin the coordinated Safe Core maintenance commit');
const policyExample=JSON.parse(fs.readFileSync(path.join(root,'.codex-safe.example.json'),'utf8'));
assert.match(String(policyExample.$schema||''),new RegExp(expectedCoreCommit),'.codex-safe.example.json schema provenance must match exact Core gitlink');

for (const forbidden of ['bootstrap.js', 'src/core.js', 'src/extension-entry.js']) assert.strictEqual(fs.existsSync(path.join(root, forbidden)), false, `${forbidden} is a forbidden transitional entry/proxy`);

const html = previewHtml({ cspSource: 'vscode-webview://test' }, { title: 'Improve PR safety', body: 'Body', baseRef: 'origin/main', headBranch: 'feature/safe', headOid: 'a'.repeat(40), baseOid: 'b'.repeat(40), titleMaxLength: 88, maxBodyChars: 7000, localDirty: false, stale: true, canOpenGitHub: true, reviewEvidence: { status: 'unavailable' } }, ui);
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
assert.match(extension, /provenance,\s*reviewEvidence/s, 'preview state must retain execution provenance');
assert.match(extension, /codex\.provenance/, 'generation must forward Codex provenance into preview state');

const codexSource = fs.readFileSync(path.join(root, 'src', 'codex.js'), 'utf8');
for (const field of ['safeCoreVersion', 'safeContractVersion', 'policySchemaVersion', 'promptContractVersion', 'codexVersion', 'requestedModel', 'resolvedModel']) assert.match(codexSource, new RegExp(`\\b${field}\\b`), `PR provenance must include ${field}`);
assert.match(codexSource, /PR_PROMPT_CONTRACT_VERSION/);
assert.match(codexSource, /POLICY_SCHEMA_VERSION/);

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
assert.match(release, /actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8/);
assert.match(release, /immutable assets will not be overwritten/);
assert.doesNotMatch(release, /--clobber/);
assert.doesNotMatch(release, /tags:\s*\[/);

const marketplace=fs.readFileSync(path.join(root,'.github','workflows','marketplace.yml'),'utf8');
assert.match(marketplace,/gh release download/);
assert.match(marketplace,/sha256sum -c SHA256SUMS/);
assert.match(marketplace,/gh attestation verify .* -R "\$GITHUB_REPOSITORY"/);
assert.match(marketplace,/vsce publish --packagePath/);
assert.doesNotMatch(marketplace,/npm run package|vsce package/,'Marketplace must not rebuild the GitHub Release VSIX');
const renovate=JSON.parse(fs.readFileSync(path.join(root,'renovate.json'),'utf8'));
assert.ok(renovate.extends.includes(':automergeDisabled'));
assert.equal(renovate.minimumReleaseAge,'3 days');
const verification=fs.readFileSync(path.join(root,'VERIFY_RELEASE.md'),'utf8');
assert.match(verification,/gh attestation verify codex-pr-safe-<version>\.vsix -R jiying2007\/codex-pr/);

require('./verify-product-docs');

console.log('Family v4.0.1 hardening, exact Core/schema provenance, Marketplace reuse, workspace trust, immutable release and product documentation tests passed.');
