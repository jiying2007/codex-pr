'use strict';

const { detectProvider, authorityFor } = require('./remote');

const DEFAULT_PROBE_TIMEOUT_MS = 3000;

function probePrefixes(remote) {
  const prefixes = [''];
  if (remote.webOrigin) {
    const parts = String(remote.path || '').split('/').filter(Boolean);
    if (parts.length >= 3) prefixes.push(`/${parts[0]}`);
  }
  return [...new Set(prefixes)];
}

function probeOrigins(remote, config = {}) {
  if (remote.scheme === 'http') return config.allowInsecureHttp ? [remote.webOrigin] : [];
  if (remote.scheme === 'https') return [remote.webOrigin];
  const authority = authorityFor(remote.host);
  const origins = [`https://${authority}`];
  if (config.allowInsecureHttp) origins.push(`http://${authority}`);
  return origins;
}

function probeOrigin(remote, config = {}) {
  return probeOrigins(remote, config)[0] || null;
}

async function probeRequest(url, { fetchImpl = fetch, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain;q=0.9', 'User-Agent': 'codex-change-safe/provider-discovery' },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (cause) {
    return { ok: false, url, status: 0, code: cause?.code || cause?.cause?.code || cause?.name || 'ENETWORK' };
  }
  let text = '';
  try { text = (await response.text()).slice(0, 8192); } catch {}
  return { ok: response.ok, url, status: response.status, text, headers: response.headers };
}

function looksLikeGitLab(result) {
  if (!result?.ok || result.status !== 200) return false;
  return /^GitLab OK\s*$/i.test(String(result.text || '').trim());
}

function looksLikeGitHubApi(result) {
  if (!result?.ok || result.status !== 200) return false;
  try {
    const value = JSON.parse(result.text || '{}');
    return typeof value.current_user_url === 'string' && typeof value.repository_url === 'string' && typeof value.rate_limit_url === 'string';
  } catch { return false; }
}

function matchRank(item) {
  return (item.origin.startsWith('https://') ? 1_000_000 : 0) + String(item.prefix || '').length;
}

function selectMatch(matches) {
  const unique = [...new Map(matches.map(item => [`${item.kind}:${item.apiBaseUrl}`, item])).values()];
  const kinds = [...new Set(unique.map(item => item.kind))];
  if (kinds.length > 1) return { match: null, ambiguous: true };
  if (!unique.length) return { match: null, ambiguous: false };
  unique.sort((a, b) => matchRank(b) - matchRank(a));
  return { match: unique[0], ambiguous: false };
}

async function probeProvider(remote, config = {}, options = {}) {
  const origins = probeOrigins(remote, config);
  if (!origins.length) return Object.freeze({ kind: null, apiBaseUrl: '', mode: 'blocked-insecure-http', probes: Object.freeze([]) });
  const probes = [];
  const matches = [];
  for (const origin of origins) {
    for (const prefix of probePrefixes(remote)) {
      const gitlab = await probeRequest(`${origin}${prefix}/-/health`, options);
      probes.push({ provider: 'gitlab', origin, prefix, url: gitlab.url, status: gitlab.status, code: gitlab.code || '' });
      if (looksLikeGitLab(gitlab)) matches.push({ kind: 'gitlab', apiBaseUrl: `${origin}${prefix}/api/v4`, origin, prefix });

      const github = await probeRequest(`${origin}${prefix}/api/v3/`, options);
      probes.push({ provider: 'github', origin, prefix, url: github.url, status: github.status, code: github.code || '' });
      if (looksLikeGitHubApi(github)) matches.push({ kind: 'github', apiBaseUrl: `${origin}${prefix}/api/v3`, origin, prefix });
    }
  }
  const selected = selectMatch(matches);
  if (selected.ambiguous) return Object.freeze({ kind: null, apiBaseUrl: '', mode: 'ambiguous', probes: Object.freeze(probes) });
  if (selected.match) return Object.freeze({ ...selected.match, mode: 'same-host-tokenless-probe', probes: Object.freeze(probes) });
  return Object.freeze({ kind: null, apiBaseUrl: '', mode: 'not-detected', probes: Object.freeze(probes) });
}

function configuredApiMissing(kind, config) {
  if (kind === 'gitlab') return !String(config.gitlabApiBaseUrl || '').trim();
  const base = String(config.githubApiBaseUrl || '').trim();
  return !base || base === 'https://api.github.com';
}

function restrictedExplicitGitLab(discovery) {
  const restricted = (discovery?.probes || []).filter(probe => probe.provider === 'gitlab' && [401, 403].includes(Number(probe.status)));
  if (!restricted.length) return null;
  restricted.sort((a, b) => matchRank(b) - matchRank(a));
  const chosen = restricted[0];
  return { kind: 'gitlab', apiBaseUrl: `${chosen.origin}${chosen.prefix}/api/v4`, origin: chosen.origin, prefix: chosen.prefix, mode: 'explicit-provider-transport-probe', probes: discovery.probes };
}

function withDiscoveredBase(kind, config, discovery) {
  const resolved = { ...config, provider: kind };
  if (kind === 'gitlab' && !resolved.gitlabApiBaseUrl) resolved.gitlabApiBaseUrl = discovery.apiBaseUrl;
  if (kind === 'github' && (!resolved.githubApiBaseUrl || resolved.githubApiBaseUrl === 'https://api.github.com')) resolved.githubApiBaseUrl = discovery.apiBaseUrl;
  return Object.freeze({ kind, config: Object.freeze(resolved), discovery: Object.freeze(discovery) });
}

async function resolveProviderConfig(remote, config = {}, options = {}) {
  let detected;
  try { detected = detectProvider(remote, config); }
  catch (error) {
    if (error.code !== 'EPROVIDERUNKNOWN') throw error;
    const discovery = await probeProvider(remote, config, options);
    if (!discovery.kind) {
      const failure = new Error(`Cannot identify SCM provider for ${remote.host}. Configure safeCodexChange.provider and the matching API base URL, or fix the reported TLS/network reachability.`);
      failure.code = discovery.mode === 'blocked-insecure-http' ? 'EINSECURESCM' : 'EPROVIDERUNKNOWN';
      failure.discovery = discovery;
      throw failure;
    }
    return withDiscoveredBase(discovery.kind, config, discovery);
  }

  const explicit = String(config.provider || 'auto').toLowerCase();
  const customSshLike = !['http', 'https'].includes(remote.scheme) && !['github.com', 'gitlab.com'].includes(remote.host);
  if (explicit !== 'auto' && customSshLike && configuredApiMissing(detected, config)) {
    const discovery = await probeProvider(remote, config, options);
    if (discovery.kind && discovery.kind !== detected) {
      const error = new Error(`Configured provider ${detected} conflicts with tokenless same-host discovery (${discovery.kind}).`);
      error.code = 'EPROVIDERMISMATCH';
      error.discovery = discovery;
      throw error;
    }
    if (discovery.kind === detected) return withDiscoveredBase(detected, config, discovery);
    if (detected === 'gitlab') {
      const restricted = restrictedExplicitGitLab(discovery);
      if (restricted) return withDiscoveredBase(detected, config, restricted);
    }
  }
  return Object.freeze({ kind: detected, config: Object.freeze({ ...config }), discovery: null });
}

module.exports = { DEFAULT_PROBE_TIMEOUT_MS, probePrefixes, probeOrigins, probeOrigin, probeRequest, looksLikeGitLab, looksLikeGitHubApi, selectMatch, probeProvider, resolveProviderConfig, restrictedExplicitGitLab };
