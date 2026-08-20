'use strict';

const fs = require('fs');
const assert = require('assert');

{
  const file = 'extension.js';
  let source = fs.readFileSync(file, 'utf8');
  const before = "function isChineseUi() { return /^zh(?:-|$)/i.test(String(vscode.env?.language || '')); }\nfunction ui(zh, en) { return isChineseUi() ? zh : en; }";
  const after = `function formatLocalized(message, args = []) {
  return String(message).replace(/\\{(\\d+)\\}/g, (_match, index) =>
    args[Number(index)] === undefined ? \\`{\\${index}}\\` : String(args[Number(index)])
  );
}
function isChineseUi() { return /^zh(?:-|$)/i.test(String(vscode.env?.language || '')); }
function t(message, ...args) {
  if (vscode.l10n?.t) return vscode.l10n.t(message, ...args);
  return formatLocalized(message, args);
}
function ui(zh, en, ...args) {
  const english = formatLocalized(en, args);
  const localized = t(en, ...args);
  if (localized !== english || !isChineseUi()) return localized;
  return formatLocalized(zh, args);
}`;

  assert.ok(source.includes(before), 'expected legacy ui helper was not found');
  source = source.replace(before, after);
  fs.writeFileSync(file, source, 'utf8');
}

{
  const file = 'test.js';
  let source = fs.readFileSync(file, 'utf8');
  const marker = "test('non-Windows command preparation never uses shell', () => {";
  assert.ok(source.includes(marker), 'test insertion marker was not found');
  const addition = `test('all safeCodexPr settings are application scoped', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const properties = pkg.contributes?.configuration?.properties || {};
  const keys = Object.keys(properties).filter(key => key.startsWith('safeCodexPr.'));
  assert.ok(keys.length > 0, 'no safeCodexPr settings found');
  for (const key of keys) assert.strictEqual(properties[key].scope, 'application', \\`${key} must remain application scoped\\`);
});

test('package declares runtime l10n and product identity remains stable', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'codex-pr-safe');
  assert.strictEqual(pkg.publisher, 'jiying2007');
  assert.strictEqual(pkg.l10n, './l10n');
  assert.ok(fs.existsSync(path.join(__dirname, 'l10n', 'bundle.l10n.json')));
  assert.ok(fs.existsSync(path.join(__dirname, 'l10n', 'bundle.l10n.zh-cn.json')));
});

`;
  source = source.replace(marker, addition + marker);
  fs.writeFileSync(file, source, 'utf8');
}

console.log('Runtime localization routing and product-family contract tests applied.');
