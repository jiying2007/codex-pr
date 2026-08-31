'use strict';
const NAMES = new Set(['summary','impact','verification','review','rollback','evidence']);
function markers(name) { return { start: `<!-- codex-change-safe:${name}:start -->`, end: `<!-- codex-change-safe:${name}:end -->` }; }
function inspectManagedBody(body) {
  const text = String(body || ''); const problems = [];
  for (const name of NAMES) {
    const { start, end } = markers(name);
    const starts = text.split(start).length - 1, ends = text.split(end).length - 1;
    if (starts !== ends || starts > 1) problems.push({ name, starts, ends });
    if (starts === 1 && text.indexOf(start) > text.indexOf(end)) problems.push({ name, starts, ends, order: 'reversed' });
  }
  return { valid: problems.length === 0, problems };
}
function assertManagedBody(body) {
  const inspection = inspectManagedBody(body);
  if (!inspection.valid) { const error = new Error(`PR/MR body contains malformed or duplicate Codex Change Safe markers: ${inspection.problems.map(x => x.name).join(', ')}.`); error.code = 'EMANAGEDMARKERS'; throw error; }
  return inspection;
}
function renderSection(name, content) { const { start, end } = markers(name); return `${start}\n${String(content || '').trim()}\n${end}`; }
function upsertSection(body, name, content) {
  if (!NAMES.has(name)) throw new Error(`Unsupported managed section: ${name}`);
  assertManagedBody(body);
  const source = String(body || '').trimEnd(); const { start, end } = markers(name); const rendered = renderSection(name, content);
  const from = source.indexOf(start); if (from < 0) return `${source}${source ? '\n\n' : ''}${rendered}`;
  const to = source.indexOf(end, from) + end.length; return `${source.slice(0, from)}${rendered}${source.slice(to)}`;
}
function upsertManagedBody(body, sections) { let out = String(body || ''); assertManagedBody(out); for (const [name, content] of Object.entries(sections)) out = upsertSection(out, name, content); return out.trim(); }
module.exports = { markers, inspectManagedBody, assertManagedBody, renderSection, upsertSection, upsertManagedBody };
