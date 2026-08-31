'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });

const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) {
  console.error('npm_execpath is unavailable; run the build through npm.');
  process.exit(1);
}

const args = [
  npmCli,
  'exec', '--yes', '--package=esbuild@0.28.2', '--', 'esbuild',
  'extension.js', '--bundle', '--platform=node', '--format=cjs', '--target=node20',
  '--external:vscode', `--outfile=${path.join('dist', 'extension.js')}`
];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) {
  console.error(`esbuild launcher failed: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
