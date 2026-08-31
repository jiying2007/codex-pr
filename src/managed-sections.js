'use strict';
const SECTION_RE = name => new RegExp(`<!-- codex-change-safe:${name}:start -->[\\s\\S]*?<!-- codex-change-safe:${name}:end -->`, 'm');
function renderSection(name, content) { return `<!-- codex-change-safe:${name}:start -->\n${String(content || '').trim()}\n<!-- codex-change-safe:${name}:end -->`; }
function upsertSection(body, name, content) {
  const source = String(body || '').trimEnd();
  const rendered = renderSection(name, content);
  return SECTION_RE(name).test(source) ? source.replace(SECTION_RE(name), rendered) : `${source}${source ? '\n\n' : ''}${rendered}`;
}
function upsertManagedBody(body, sections) { let out = String(body || ''); for (const [name, content] of Object.entries(sections)) out = upsertSection(out, name, content); return out.trim(); }
module.exports = { renderSection, upsertSection, upsertManagedBody };
