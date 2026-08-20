'use strict';

const fs = require('fs');
const assert = require('assert');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifestEn = JSON.parse(fs.readFileSync('package.nls.json', 'utf8'));
const manifestZh = JSON.parse(fs.readFileSync('package.nls.zh-cn.json', 'utf8'));
const runtimeEn = JSON.parse(fs.readFileSync('l10n/bundle.l10n.json', 'utf8'));
const runtimeZh = JSON.parse(fs.readFileSync('l10n/bundle.l10n.zh-cn.json', 'utf8'));

assert.strictEqual(pkg.l10n, './l10n', 'package.json must declare the runtime l10n directory');
assert.deepStrictEqual(Object.keys(manifestEn).sort(), Object.keys(manifestZh).sort(), 'Manifest NLS catalogs must contain identical keys');
assert.deepStrictEqual(Object.keys(runtimeEn).sort(), Object.keys(runtimeZh).sort(), 'Runtime localization bundles must contain identical keys');

const manifestText = JSON.stringify(pkg);
const placeholders = new Set([...manifestText.matchAll(/%([^%]+)%/g)].map(match => match[1]));
for (const key of placeholders) {
  assert.ok(Object.prototype.hasOwnProperty.call(manifestEn, key), `Missing English manifest NLS key: ${key}`);
  assert.ok(Object.prototype.hasOwnProperty.call(manifestZh, key), `Missing Chinese manifest NLS key: ${key}`);
}

const runtimeFiles = ['extension.js', 'src/preview.js'];
const runtimeKeys = new Set();
for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bui\(\s*'[^']*'\s*,\s*'([^']+)'\s*\)/g)) runtimeKeys.add(match[1]);
  for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) runtimeKeys.add(match[1]);
}

for (const key of runtimeKeys) {
  assert.ok(Object.prototype.hasOwnProperty.call(runtimeEn, key), `Missing English runtime l10n key: ${key}`);
  assert.ok(Object.prototype.hasOwnProperty.call(runtimeZh, key), `Missing Chinese runtime l10n key: ${key}`);
  assert.strictEqual(runtimeEn[key], key, `English runtime l10n value must equal source key: ${key}`);
  assert.ok(typeof runtimeZh[key] === 'string' && runtimeZh[key].trim(), `Chinese runtime l10n value is empty: ${key}`);
}

console.log(`Localization catalogs OK: manifest=${Object.keys(manifestEn).length}, runtime=${Object.keys(runtimeEn).length}, sourceKeys=${runtimeKeys.size}.`);
