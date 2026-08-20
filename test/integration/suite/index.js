'use strict';

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function runGit(root, args) {
  cp.execFileSync('git', ['-C', root, ...args], { stdio: 'inherit' });
}

async function run() {
  const root = process.env.CODEX_PR_TEST_WORKSPACE;
  const codexPath = process.env.CODEX_PR_TEST_CODEX_PATH;
  assert.ok(root && codexPath, 'test environment missing');
  const cfg = vscode.workspace.getConfiguration('safeCodexPr');
  await cfg.update('codexPath', codexPath, vscode.ConfigurationTarget.Global);
  await cfg.update('baseBranch', 'main', vscode.ConfigurationTarget.Workspace);
  await cfg.update('language', 'zh-CN', vscode.ConfigurationTarget.Global);
  await cfg.update('timeoutSeconds', 30, vscode.ConfigurationTarget.Global);

  const extension = vscode.extensions.getExtension('jiying2007.codex-pr-safe');
  assert.ok(extension, 'extension not found');
  await extension.activate();

  await vscode.commands.executeCommand('safeCodexPr.generate');
  const state = await vscode.commands.executeCommand('safeCodexPr._testState', root);
  assert.ok(state, 'generated PR state missing');
  assert.strictEqual(state.title, 'Add safe PR generation');
  assert.strictEqual(state.baseRef, 'main');
  assert.strictEqual(state.headBranch, 'feature/pr-safe');
  assert.strictEqual(state.localDirty, true);
  assert.match(state.body, /Test execution was not verified by Codex PR Safe/);
  assert.match(state.body, /Risk level: low/);

  await vscode.commands.executeCommand('safeCodexPr.copyAll');
  const clipboard = await vscode.env.clipboard.readText();
  assert.match(clipboard, /^Add safe PR generation/);
  assert.match(clipboard, /## Summary/);

  fs.writeFileSync(path.join(root, 'after-generation.js'), 'module.exports = true;\n');
  runGit(root, ['add', 'after-generation.js']);
  runGit(root, ['commit', '-m', 'test: change HEAD after generation']);
  await assert.rejects(() => vscode.commands.executeCommand('safeCodexPr.copyAll'), /stale|HEAD or base changed/i);

  console.log('Codex PR Safe Extension Host integration test passed.');
}

module.exports = { run };