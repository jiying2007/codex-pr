'use strict';

const assert = require('assert');
const vscode = require('vscode');

async function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
  const root = process.env.CODEX_PR_TEST_WORKSPACE;
  const codexPath = process.env.CODEX_PR_TEST_CODEX_PATH;
  assert.ok(root && codexPath, 'test environment missing');
  const cfg = vscode.workspace.getConfiguration('safeCodexPr');
  await cfg.update('codexPath', codexPath, vscode.ConfigurationTarget.Global);
  await cfg.update('baseBranch', 'main', vscode.ConfigurationTarget.Workspace);
  await cfg.update('language', 'en', vscode.ConfigurationTarget.Global);
  await cfg.update('timeoutSeconds', 30, vscode.ConfigurationTarget.Global);

  const extension = vscode.extensions.getExtension('jiying2007.codex-pr-safe');
  assert.ok(extension, 'extension not found');
  await extension.activate();

  await vscode.commands.executeCommand('safeCodexPr.generate');
  await wait(200);
  const state = await vscode.commands.executeCommand('safeCodexPr._testState', root);
  assert.ok(state, 'generated PR state missing');
  assert.strictEqual(state.title, 'Add safe PR generation');
  assert.strictEqual(state.baseRef, 'main');
  assert.strictEqual(state.headBranch, 'feature/pr-safe');
  assert.strictEqual(state.localDirty, true);
  assert.match(state.body, /No verifiable test execution information was provided/);
  assert.match(state.body, /Risk level: low/);

  await vscode.commands.executeCommand('safeCodexPr.copyAll');
  const clipboard = await vscode.env.clipboard.readText();
  assert.match(clipboard, /^Add safe PR generation/);
  assert.match(clipboard, /## Summary/);

  const options = vscode.workspace.getConfiguration('safeCodexPr');
  assert.strictEqual(options.get('language'), 'en');
  console.log('Codex PR Safe Extension Host integration test passed.');
}

module.exports = { run };
