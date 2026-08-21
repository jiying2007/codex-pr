'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, v) => fs.writeFileSync(path.join(root, p), v);

for (const file of ['bootstrap.js', 'extension.js', 'src/codex.js', 'test.js']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  let text = fs.readFileSync(full, 'utf8');
  text = text.replaceAll("require('./src/safe-contract')", "require('./src/codex-safe-core/safe-contract')");
  text = text.replaceAll("require('./safe-contract')", "require('./codex-safe-core/safe-contract')");
  text = text.replaceAll("require('../src/safe-contract')", "require('../src/codex-safe-core/safe-contract')");
  fs.writeFileSync(full, text);
}

fs.unlinkSync(path.join(root, 'src', 'safe-contract.js'));
const pkg = JSON.parse(read('package.json'));
pkg.scripts.check = String(pkg.scripts.check).replace('node --check src/safe-contract.js && ', '');
if (!pkg.scripts.check.includes('node --check src/codex-safe-core/safe-contract.js')) {
  pkg.scripts.check = pkg.scripts.check.replace('node --check src/codex.js && ', 'node --check src/codex.js && node --check src/codex-safe-core/safe-contract.js && node --check src/codex-safe-core/codex-cli.js && ');
}
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

const manifest = JSON.parse(read('src/codex-safe-core/manifest.json'));
manifest.source.ref = 'main';
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
write('src/codex-safe-core/manifest.json', manifestText);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const lock = JSON.parse(read('safe-core.lock.json'));
lock.source = { ...manifest.source };
lock.safeCoreVersion = manifest.safeCoreVersion;
lock.manifestSha256 = sha256(Buffer.from(manifestText, 'utf8'));
lock.files = { ...manifest.files };
write('safe-core.lock.json', `${JSON.stringify(lock, null, 2)}\n`);

if (read('src/codex.js').includes("require('./safe-contract')")) throw new Error('legacy Safe Contract import remains');
if (read('safe-core.lock.json').includes('safe-core-v1')) throw new Error('legacy Safe Core branch remains');
console.log('Codex PR Safe transition residue removed.');
