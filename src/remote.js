'use strict';

function normalizeHost(value) {
  return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function hostForUrl(host) {
  const normalized = normalizeHost(host);
  return normalized.includes(':') ? `[${normalized}]` : normalized;
}

function authorityFor(host, port = '') {
  return `${hostForUrl(host)}${port ? `:${port}` : ''}`;
}

function parseScpRemote(value) {
  const raw = String(value || '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return null;
  const match = raw.match(/^(?:([^@\s]+)@)?([^:\s]+):(.+)$/);
  if (!match) return null;
  const host = normalizeHost(match[2]);
  return { scheme: 'ssh', user: match[1] || '', host, port: '', authority: authorityFor(host), path: match[3], webOrigin: '' };
}

function parseRemote(value) {
  const raw = String(value || '').trim();
  const scp = parseScpRemote(raw);
  let parsed;
  if (scp) parsed = scp;
  else {
    let url;
    try { url = new URL(raw); } catch {
      const error = new Error(`Unsupported git remote URL: ${raw}`);
      error.code = 'EREMOTEURL';
      throw error;
    }
    const scheme = url.protocol.replace(':', '').toLowerCase();
    const host = normalizeHost(url.hostname);
    const port = url.port || '';
    parsed = {
      scheme,
      user: url.username,
      host,
      port,
      authority: authorityFor(host, port),
      path: url.pathname.replace(/^\/+/, ''),
      webOrigin: ['http', 'https'].includes(scheme) ? `${scheme}://${authorityFor(host, port)}` : ''
    };
  }
  const path = parsed.path.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) {
    const error = new Error(`Remote path does not identify a repository: ${raw}`);
    error.code = 'EREMOTEREPO';
    throw error;
  }
  return {
    ...parsed,
    raw,
    path,
    owner: parts[0],
    repo: parts.at(-1),
    projectPath: parts.join('/'),
    repoFullName: parts.join('/')
  };
}

function configuredProviderMatches(remote, config = {}) {
  const matches = [];
  for (const [provider, base] of [['github', config.githubApiBaseUrl], ['gitlab', config.gitlabApiBaseUrl]]) {
    if (!base) continue;
    try {
      if (normalizeHost(new URL(base).hostname) === remote.host) matches.push(provider);
    } catch {}
  }
  return [...new Set(matches)];
}

function detectProvider(remote, config = {}) {
  const explicit = String(config.provider || 'auto').toLowerCase();
  if (!['auto', 'github', 'gitlab'].includes(explicit)) {
    const error = new Error(`Unsupported SCM provider setting: ${explicit}`);
    error.code = 'EPROVIDERCONFIG';
    throw error;
  }
  if (explicit !== 'auto') {
    if ((remote.host === 'github.com' && explicit !== 'github') || (remote.host === 'gitlab.com' && explicit !== 'gitlab')) {
      const error = new Error(`Configured provider ${explicit} conflicts with well-known remote host ${remote.host}.`);
      error.code = 'EPROVIDERMISMATCH';
      throw error;
    }
    return explicit;
  }
  if (remote.host === 'github.com') return 'github';
  if (remote.host === 'gitlab.com') return 'gitlab';
  const matches = configuredProviderMatches(remote, config);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const error = new Error(`SCM provider is ambiguous for custom host ${remote.host}; both API base URLs match it.`);
    error.code = 'EPROVIDERAMBIGUOUS';
    throw error;
  }
  const error = new Error(`Cannot safely infer SCM provider for custom host ${remote.host}; automatic same-host probing is required or set safeCodexChange.provider explicitly.`);
  error.code = 'EPROVIDERUNKNOWN';
  throw error;
}

module.exports = { normalizeHost, hostForUrl, authorityFor, parseRemote, detectProvider, configuredProviderMatches };
