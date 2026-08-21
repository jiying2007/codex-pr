'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { previewHtml } = require('../src/preview');

function ui(_zh, en, ...args) {
  return String(en).replace(/\{(\d+)\}/g, (_match, index) => String(args[Number(index)] ?? `{${index}}`));
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

const extension = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
assert.match(extension, /currentBranch/);
assert.match(extension, /a\.headBranch === b\.headBranch/);
assert.match(extension, /localResourceRoots:\s*\[\]/);
assert.doesNotMatch(extension, /retainContextWhenHidden/);
assert.match(extension, /validateEditedResult\(message\.title, message\.body, latest\)/);
assert.match(extension, /validateEditedResult\(state\.title, state\.body, state\)/);
assert.match(extension, /await ensureFreshResult\(latest\);\s*latest\.compareUrl/s);

console.log('hardening regression tests passed.');
