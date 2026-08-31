'use strict';
const { unique } = require('./util');
function globToRegExp(pattern) {
  let p = String(pattern || '').trim();
  const anchored = p.startsWith('/'); if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith('/'); if (dirOnly) p += '**';
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') { while (p[i + 1] === '*') i++; out += '.*'; }
      else out += '[^/]*';
    } else if (ch === '?') out += '[^/]';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(anchored ? `^${out}$` : `(?:^|.*/)${out}$`);
}
function parseCodeowners(text) {
  const rules = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/); if (parts.length < 2) continue;
    const pattern = parts.shift(); const owners = parts.filter(x => x.startsWith('@')).map(x => x.slice(1)).filter(x => !x.includes('/'));
    if (owners.length) rules.push({ pattern, owners, regex: globToRegExp(pattern) });
  }
  return rules;
}
function ownersForPath(path, rules) { let owners = []; for (const rule of rules) if (rule.regex.test(path)) owners = rule.owners; return owners; }
function suggestReviewers(paths, rules, extras = []) { return unique([...extras, ...paths.flatMap(path => ownersForPath(path, rules))]); }
module.exports = { globToRegExp, parseCodeowners, ownersForPath, suggestReviewers };
