'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;
const values = {
  codexPath: 'codex',
  model: '',
  language: 'en',
  maxDiffBytes: 4096,
  maxCommitBytes: 65536,
  titleMaxLength: 100,
  maxBodyChars: 8000,
  includePullRequestTemplate: true,
  extraInstructions: '',
  timeoutSeconds: 120
};
const fakeVscode = {
  workspace: {
    isTrusted: true,
    getConfiguration() {
      return {
        inspect(key) {
          return { defaultValue: values[key], globalValue: values[key] };
        }
      };
    }
  },
  extensions: { getExtension() { return undefined; } }
};
Module._load = function(request, parent, isMain) {
  if (request === 'vscode') return fakeVscode;
  return originalLoad.call(this, request, parent, isMain);
};

const provider = require('../src/github-pr-provider');

(async () => {
  const options = provider.getProviderOptions();
  assert.strictEqual(options.language, 'en');
  assert.strictEqual(options.maxDiffBytes, 4096);

  const normalized = provider.normalizeProviderContext({
    commitMessages: ['fix: correct edge case'],
    patches: [{
      patch: 'diff --git a/src/a.js b/src/a.js\n--- a/src/a.js\n+++ b/src/a.js\n@@ -1 +1 @@\n-old\n+const fixed = true;\n',
      fileUri: 'file:///Users/private/project/src/a.js',
      previousFileUri: 'file:///Users/private/old/src/a.js'
    }],
    template: '## Summary\n',
    compareBranch: 'feature/fix'
  }, options);
  assert(normalized);
  assert.strictEqual(normalized.contextTruncated, false);
  const input = provider.buildProviderInput(options, normalized);
  assert.match(input, /fix: correct edge case/);
  assert.match(input, /Source files \(1\)/);
  assert.match(input, /LOCAL FILE URI METADATA: intentionally omitted/);
  assert.doesNotMatch(input, /Users\/private/);
  assert.doesNotMatch(input, /file:\/\//);

  const hugeSource = 'diff --git a/src/huge.js b/src/huge.js\n--- a/src/huge.js\n+++ b/src/huge.js\n@@ -1 +1,1000 @@\n' + '+const x = 1;\n'.repeat(1000);
  const bounded = provider.normalizeProviderContext({ commitMessages: ['x'], patches: [{ patch: hugeSource }] }, options);
  assert(bounded);
  assert.strictEqual(bounded.contextTruncated, true);
  assert.ok(Buffer.byteLength(bounded.patches, 'utf8') <= options.maxDiffBytes + 2048);
  assert.match(bounded.patches, /semantic budget/i);

  const generatedOnly = provider.normalizeProviderContext({
    commitMessages: ['chore: lock'],
    patches: [{ patch: 'diff --git a/package-lock.json b/package-lock.json\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1 +1 @@\n-old\n+new\n' }]
  }, options);
  assert(generatedOnly);
  assert.match(generatedOnly.patches, /Generated\/lock files/);
  assert.doesNotMatch(generatedOnly.patches, /\+new/);

  assert.throws(() => provider.normalizeProviderContext({
    commitMessages: ['x'],
    patches: [{ patch: 'x'.repeat(provider.RAW_PATCH_HARD_LIMIT_BYTES + 1) }]
  }, options), error => error.code === 'EDIFFHARDLIMIT');

  const unavailable = await provider.registerGitHubPullRequestProvider({ subscriptions: [] });
  assert.strictEqual(unavailable.status, 'unavailable');

  let registeredTitle = '';
  let registeredProvider;
  const disposable = { dispose() {} };
  fakeVscode.extensions.getExtension = () => ({
    isActive: true,
    exports: {
      registerTitleAndDescriptionProvider(title, value) {
        registeredTitle = title;
        registeredProvider = value;
        return disposable;
      }
    }
  });
  const context = { subscriptions: [] };
  const registered = await provider.registerGitHubPullRequestProvider(context);
  assert.strictEqual(registered.status, 'registered');
  assert.strictEqual(registeredTitle, 'Codex PR Safe');
  assert.strictEqual(typeof registeredProvider.provideTitleAndDescription, 'function');
  assert.strictEqual(context.subscriptions[0], disposable);

  fakeVscode.workspace.isTrusted = false;
  const restricted = await provider.registerGitHubPullRequestProvider({ subscriptions: [] });
  assert.strictEqual(restricted.status, 'restricted');

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.main, './dist/extension.js');
  assert.ok(!pkg.activationEvents.includes('onStartupFinished'));
  assert.deepStrictEqual(pkg.contributes.jsonValidation, [{ fileMatch: '.codex-safe.json', url: './dist/codex-safe.schema.json' }]);
  assert.ok(!Array.isArray(pkg.extensionDependencies) || !pkg.extensionDependencies.includes('GitHub.vscode-pull-request-github'));

  console.log('GitHub Pull Requests provider v2 regression tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
