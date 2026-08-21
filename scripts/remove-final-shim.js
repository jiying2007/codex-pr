'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const p = rel => path.join(root, rel);
const exists = rel => fs.existsSync(p(rel));
const read = rel => fs.readFileSync(p(rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(p(rel), text);
const fail = message => { throw new Error(message); };

function rewrite(rel) {
  if (!exists(rel)) return;
  let text = read(rel);
  text = text
    .replaceAll("require('./src/safe-contract')", "require('./src/codex-safe-core/safe-contract')")
    .replaceAll("require('./safe-contract')", "require('./codex-safe-core/safe-contract')")
    .replaceAll("require('../src/safe-contract')", "require('../src/codex-safe-core/safe-contract')");
  write(rel, text);
}

for (const rel of ['bootstrap.js', 'extension.js', 'test.js']) rewrite(rel);
for (const dir of ['src', 'test', 'scripts']) {
  if (!exists(dir)) continue;
  const visit = current => {
    for (const entry of fs.readdirSync(p(current), { withFileTypes: true })) {
      const rel = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (rel === path.join('src', 'codex-safe-core')) continue;
        visit(rel);
      } else if (entry.name.endsWith('.js')) {
        rewrite(rel);
      }
    }
  };
  visit(dir);
}

if (exists('src/safe-contract.js')) fs.unlinkSync(p('src/safe-contract.js'));

const pkg = JSON.parse(read('package.json'));
pkg.scripts.check = String(pkg.scripts.check || '').replace('node --check src/safe-contract.js && ', '');
if (!pkg.scripts.check.includes('node --check src/codex-safe-core/safe-contract.js')) {
  pkg.scripts.check = pkg.scripts.check.replace(
    'node --check src/codex.js && ',
    'node --check src/codex.js && node --check src/codex-safe-core/safe-contract.js && node --check src/codex-safe-core/codex-cli.js && '
  );
}
if (pkg.scripts.check.includes('src/safe-contract.js')) fail('package check still references shim');
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

if (exists('PUBLISHING.md')) {
  let publishing = read('PUBLISHING.md');
  publishing = publishing.replace(
    '- `src/safe-contract.js`\n',
    '- `src/codex-safe-core/codex-cli.js`\n- `src/codex-safe-core/safe-contract.js`\n- `src/codex-safe-core/manifest.json`\n'
  );
  if (publishing.includes('`src/safe-contract.js`')) fail('PUBLISHING still references shim');
  write('PUBLISHING.md', publishing);
}

if (exists('scripts/final-transition-cleanup.js')) fs.unlinkSync(p('scripts/final-transition-cleanup.js'));

if (exists('src/safe-contract.js')) fail('shim remains');
for (const rel of ['bootstrap.js', 'extension.js', 'src/codex.js', 'package.json']) {
  if (!exists(rel)) continue;
  const text = read(rel);
  if (text.includes("require('./safe-contract')") || text.includes('src/safe-contract')) {
    fail(`legacy reference remains in ${rel}`);
  }
}
const canonicalCli = read('src/codex-safe-core/codex-cli.js');
if (!canonicalCli.includes("require('./safe-contract')")) fail('canonical Safe Core internal contract import was modified');
console.log('Final PR shim residue removed without modifying canonical Safe Core bytes.');
