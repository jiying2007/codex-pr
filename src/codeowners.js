'use strict';

const { unique } = require('./util');

function globToRegExp(pattern) {
  let p = String(pattern || '').trim();
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith('/');
  if (dirOnly) p += '**';
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

function splitGitLabLine(value) {
  const out = [], line = String(value || '');
  let token = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && /\s/.test(line[i + 1] || '')) { token += line[++i]; continue; }
    if (/\s/.test(ch)) { if (token) { out.push(token); token = ''; } continue; }
    token += ch;
  }
  if (token) out.push(token);
  return out;
}

function classifyOwners(tokens, unsupported, context) {
  const users = [], teams = [];
  for (const token of tokens || []) {
    if (token.startsWith('@@')) { unsupported.push({ ...context, owner: token, reason: 'gitlab_role_owner_requires_runtime_member_resolution' }); continue; }
    if (token.startsWith('@')) {
      const owner = token.slice(1);
      if (!owner) continue;
      if (owner.includes('/')) teams.push(owner); else users.push(owner);
      continue;
    }
    if (token.includes('@')) unsupported.push({ ...context, owner: token, reason: 'email_owner_not_resolved' });
    else if (token) unsupported.push({ ...context, owner: token, reason: 'malformed_owner' });
  }
  return { users: unique(users), teams: unique(teams) };
}

function parseGitHubCodeowners(text) {
  const rules = [], unsupported = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const pattern = parts.shift();
    if (pattern.startsWith('!') || pattern.includes('[')) unsupported.push({ pattern, owner: '', reason: 'unsupported_github_pattern' });
    const owners = classifyOwners(parts, unsupported, { pattern, section: 'default' });
    if (owners.users.length || owners.teams.length) rules.push({ provider: 'github', section: 'default', pattern, ...owners, excluded: false, regex: globToRegExp(pattern) });
  }
  rules.provider = 'github';
  rules.unsupported = unsupported;
  return rules;
}

function parseGitLabCodeowners(text) {
  const rules = [], unsupported = [];
  let section = 'default', defaults = { users: [], teams: [] }, optional = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^(\^)?\[([^\]]+)\](?:\[(\d+)\])?(?:\s+(.*))?$/);
    if (sectionMatch) {
      optional = Boolean(sectionMatch[1]);
      section = sectionMatch[2].trim().toLowerCase();
      defaults = classifyOwners(splitGitLabLine(sectionMatch[4] || ''), unsupported, { pattern: '', section });
      continue;
    }
    const parts = splitGitLabLine(line);
    if (!parts.length) continue;
    let pattern = parts.shift();
    const excluded = pattern.startsWith('!');
    if (excluded) pattern = pattern.slice(1);
    if (!pattern) continue;
    const explicit = classifyOwners(parts, unsupported, { pattern, section });
    const owners = explicit.users.length || explicit.teams.length ? explicit : defaults;
    if (!excluded && !owners.users.length && !owners.teams.length) {
      unsupported.push({ pattern, section, owner: '', reason: 'gitlab_rule_has_no_resolvable_owner' });
      continue;
    }
    rules.push({ provider: 'gitlab', section, optional, pattern, users: [...owners.users], teams: [...owners.teams], excluded, regex: globToRegExp(pattern) });
  }
  rules.provider = 'gitlab';
  rules.unsupported = unsupported;
  return rules;
}

function parseCodeowners(text, { provider = 'github' } = {}) {
  return provider === 'gitlab' ? parseGitLabCodeowners(text) : parseGitHubCodeowners(text);
}

function ownersForPath(path, rules) {
  if (rules?.provider !== 'gitlab') {
    let users = [], teams = [];
    for (const rule of rules || []) if (rule.regex.test(path)) { users = rule.users; teams = rule.teams; }
    return { users, teams };
  }
  const sections = new Map();
  for (const rule of rules) {
    if (!rule.regex.test(path)) continue;
    const current = sections.get(rule.section) || { users: [], teams: [], excluded: false };
    if (current.excluded) continue;
    if (rule.excluded) sections.set(rule.section, { users: [], teams: [], excluded: true });
    else sections.set(rule.section, { users: rule.users, teams: rule.teams, excluded: false });
  }
  const users = [], teams = [];
  for (const value of sections.values()) if (!value.excluded) { users.push(...value.users); teams.push(...value.teams); }
  return { users: unique(users), teams: unique(teams) };
}

function suggestReviewers(paths, rules, extras = []) {
  const users = [...extras], teams = [];
  for (const path of paths) {
    const owners = ownersForPath(path, rules);
    users.push(...owners.users);
    teams.push(...owners.teams);
  }
  return { users: unique(users), teams: unique(teams), unsupported: [...(rules?.unsupported || [])] };
}

module.exports = { globToRegExp, splitGitLabLine, classifyOwners, parseGitHubCodeowners, parseGitLabCodeowners, parseCodeowners, ownersForPath, suggestReviewers };
