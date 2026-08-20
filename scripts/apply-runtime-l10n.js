'use strict';

const fs = require('fs');
const assert = require('assert');

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
console.log('Runtime UI now routes through vscode.l10n.t with a zh-CN fallback.');
