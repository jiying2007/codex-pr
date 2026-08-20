'use strict';
const fs = require('fs');
const assert = require('assert');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('package.nls.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('package.nls.zh-cn.json', 'utf8'));
assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(zh).sort(), 'NLS catalogs must contain identical keys');
const text = JSON.stringify(pkg);
const placeholders = new Set([...text.matchAll(/%([^%]+)%/g)].map(m => m[1]));
for (const key of placeholders) {
  assert.ok(Object.prototype.hasOwnProperty.call(en, key), `Missing English NLS key: ${key}`);
  assert.ok(Object.prototype.hasOwnProperty.call(zh, key), `Missing Chinese NLS key: ${key}`);
}
console.log(`NLS catalogs OK (${Object.keys(en).length} keys).`);
