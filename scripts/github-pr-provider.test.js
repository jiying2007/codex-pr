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
  maxDiffBytes: 524288,
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
  assert.strictEqual(options.maxDiffBytes, 524288);

  const normalized = provider.normalizeProviderContext({
    commitMessages: ['fix: correct edge case'],
    patches: [{
      patch: 'diff --git a/src/a.js b/src/a.js\n+const fixed = true;\n',
      fileUri: 'file:///Users/private/project/src/a.js',
      previousFileUri: 'file:///Users/private/old/src/a.js'
    }],
    template: '## Summary\n',
    compareBranch: 'feature/fix'
  }, options);
  const input = provider.buildProviderInput(options, normalized);
  assert.match(input, /fix: correct edge case/);
  assert.match(input, /diff --git a\/src\/a\.js b\/src\/a\.js/);
  assert.match(input, /LOCAL FILE URI METADATA: intentionally omitted/);
  assert.doesNotMatch(input, /Users\/private/);
  assert.doesNotMatch(input, /file:\/\//);

  assert.throws(() => provider.normalizeProviderContext({
    commitMessages: ['x'],
    patches: [{ patch: 'x'.repeat(5000), fileUri: 'file:///secret' }]
  }, { ...options, maxDiffBytes: 4096 }), error => error.code === 'EDIFFTOOLARGE');

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
  assert.strictEqual(pkg.main, './bootstrap.js');
  assert.ok(pkg.activationEvents.includes('onStartupFinished'));
  assert.ok(!Array.isArray(pkg.extensionDependencies) || !pkg.extensionDependencies.includes('GitHub.vscode-pull-request-github'));

  console.log('GitHub Pull Requests provider regression tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
