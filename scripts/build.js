'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const runtimeModules = [
  'pr-domain.js', 'policy.js', 'process.js', 'git.js', 'git-domain.js',
  'codex.js', 'quality.js', 'preview.js', 'github-pr-provider.js'
];
const coreModules = [
  'index.js', 'safe-contract.js', 'codex-runtime.js', 'codex-cli.js', 'process-runner.js',
  'git-repository.js', 'context-builder.js', 'efficiency-planner.js', 'quality-platform.js', 'policy.js'
];
const coreRuntimeData = ['core-contract.json'];

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function main() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'src', 'codex-safe-core'), { recursive: true });
  copy(path.join(root, 'extension.js'), path.join(dist, 'extension-impl.js'));
  for (const name of runtimeModules) copy(path.join(root, 'src', name), path.join(dist, 'src', name));
  for (const name of coreModules) copy(path.join(root, 'src', 'codex-safe-core', name), path.join(dist, 'src', 'codex-safe-core', name));
  for (const name of coreRuntimeData) copy(path.join(root, 'src', 'codex-safe-core', name), path.join(dist, 'src', 'codex-safe-core', name));
  copy(path.join(root, 'src', 'codex-safe-core', 'codex-safe.schema.json'), path.join(dist, 'codex-safe.schema.json'));
  fs.writeFileSync(path.join(dist, 'extension.js'), [
    "'use strict';",
    "const extension = require('./extension-impl');",
    "const { registerGitHubPullRequestProvider } = require('./src/github-pr-provider');",
    'async function activate(context) {',
    '  const result = await Promise.resolve(extension.activate(context));',
    '  await registerGitHubPullRequestProvider(context);',
    '  return result;',
    '}',
    'function deactivate() { return extension.deactivate(); }',
    'module.exports = { ...extension, activate, deactivate };',
    ''
  ].join('\n'));
}

main();
