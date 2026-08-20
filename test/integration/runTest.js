'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const cp = require('child_process');
const { runTests } = require('@vscode/test-electron');

function run(command, args, cwd) {
  cp.execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pr-safe-integration-'));
  run('git', ['init', '-b', 'main'], root);
  run('git', ['config', 'user.email', 'codex-pr-safe@example.invalid'], root);
  run('git', ['config', 'user.name', 'Codex PR Safe Test'], root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 1;\n');
  run('git', ['add', 'app.js'], root);
  run('git', ['commit', '-m', 'chore: initial'], root);
  run('git', ['checkout', '-b', 'feature/pr-safe'], root);
  fs.writeFileSync(path.join(root, 'app.js'), 'module.exports = 2;\n');
  fs.writeFileSync(path.join(root, 'feature.js'), 'module.exports = "safe";\n');
  run('git', ['add', 'app.js', 'feature.js'], root);
  run('git', ['commit', '-m', 'feat: add safe PR generation'], root);
  fs.writeFileSync(path.join(root, 'local-only.txt'), 'not committed\n');
  return root;
}

function createFakeCodex(dir) {
  const js = path.join(dir, 'fake-codex.js');
  fs.writeFileSync(js, `
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') { console.log('codex-cli 999.0.0-test'); process.exit(0); }
const execIndex = args.indexOf('exec');
const approvalIndex = args.indexOf('--ask-for-approval');
if (execIndex < 0 || approvalIndex < 0 || approvalIndex > execIndex || args[approvalIndex + 1] !== 'never') {
  console.error("error: unexpected argument '--ask-for-approval' found"); process.exit(2);
}
if (args[args.indexOf('--sandbox') + 1] !== 'read-only') { console.error('sandbox not read-only'); process.exit(3); }
const input = fs.readFileSync(0, 'utf8');
if (!input.includes('BASE REF: main') || !input.includes('feature/pr-safe') || !input.includes('LOCAL WORKTREE: dirty') || !input.includes('--- TEXT DIFF START ---')) {
  console.error('missing expected PR context'); process.exit(4);
}
const result = {
  title: 'Add safe PR generation',
  summary: ['Generate a reviewable PR description from committed changes'],
  changes: ['Add PR generation behavior'],
  testing: [],
  risks: ['PR wording still requires human review'],
  reviewNotes: ['Review the safe generation boundary'],
  riskLevel: 'low',
  breakingChange: false
};
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) } }));
`);
  if (process.platform === 'win32') {
    const wrapper = path.join(dir, 'codex-test.cmd');
    fs.writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "${js}" %*\r\n`);
    return wrapper;
  }
  const wrapper = path.join(dir, 'codex-test');
  fs.writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`, { mode: 0o755 });
  fs.chmodSync(wrapper, 0o755);
  return wrapper;
}

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../..');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const workspace = createWorkspace();
  const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pr-safe-fake-'));
  const codexPath = createFakeCodex(fakeDir);
  try {
    await runTests({
      version: process.env.VSCODE_TEST_VERSION || 'stable',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspace, '--disable-extensions'],
      extensionTestsEnv: {
        ...process.env,
        CODEX_PR_TEST_WORKSPACE: workspace,
        CODEX_PR_TEST_CODEX_PATH: codexPath
      }
    });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(fakeDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exit(1); });
