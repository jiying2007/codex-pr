'use strict';

function parseScpRemote(value) {
  const raw = String(value || '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return null;
  const match = raw.match(/^(?:([^@\s]+)@)?([^:\s]+):(.+)$/);
  if (!match) return null;
  return { scheme: 'ssh', user: match[1] || '', host: match[2].toLowerCase(), path: match[3] };
}
function parseRemote(value) {
  const raw = String(value || '').trim();
  const scp = parseScpRemote(raw);
  let parsed;
  if (scp) parsed = scp;
  else {
    let url;
    try { url = new URL(raw); } catch {
      const error = new Error(`Unsupported git remote URL: ${raw}`); error.code = 'EREMOTEURL'; throw error;
    }
    parsed = { scheme: url.protocol.replace(':', ''), user: url.username, host: url.hostname.toLowerCase(), path: url.pathname.replace(/^\/+/, '') };
  }
  const path = parsed.path.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) { const error = new Error(`Remote path does not identify a repository: ${raw}`); error.code = 'EREMOTEREPO'; throw error; }
  return { ...parsed, raw, path, owner: parts[0], repo: parts.at(-1), projectPath: parts.join('/'), repoFullName: parts.length === 2 ? `${parts[0]}/${parts[1]}` : parts.join('/') };
}
function detectProvider(remote, config = {}) {
  const explicit = String(config.provider || 'auto').toLowerCase();
  if (explicit === 'github' || explicit === 'gitlab') return explicit;
  if (remote.host === 'github.com') return 'github';
  if (remote.host === 'gitlab.com') return 'gitlab';
  for (const [provider, base] of [['github', config.githubApiBaseUrl], ['gitlab', config.gitlabApiBaseUrl]]) {
    if (!base) continue;
    try { if (new URL(base).hostname.toLowerCase() === remote.host) return provider; } catch {}
  }
  const error = new Error(`Cannot safely infer SCM provider for custom host ${remote.host}; set safeCodexChange.provider to github or gitlab.`);
  error.code = 'EPROVIDERUNKNOWN';
  throw error;
}
module.exports = { parseRemote, detectProvider };
