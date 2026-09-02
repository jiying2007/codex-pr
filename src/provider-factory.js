'use strict';

const { detectProvider, normalizeHost, authorityFor } = require('./remote');
const { GitHubProvider } = require('./providers/github');
const { GitLabProvider } = require('./providers/gitlab');
const { assertSafeUrl } = require('./util');

const GITHUB_CLOUD_API = 'https://api.github.com';
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function aliasHosts(remoteHost, aliases = {}) {
  const host = normalizeHost(remoteHost);
  const out = new Set([host]);
  for (const [key, values] of Object.entries(aliases || {})) {
    if (normalizeHost(key) !== host || !Array.isArray(values)) continue;
    for (const value of values) if (value) out.add(normalizeHost(value));
  }
  return out;
}

function assertApiBoundToRemote(kind, remote, apiBaseUrl, trustedApiHostAliases = {}) {
  const api = new URL(apiBaseUrl);
  const apiHost = normalizeHost(api.hostname);
  const allowedHosts = aliasHosts(remote.host, trustedApiHostAliases);
  const allowed = kind === 'github' && remote.host === 'github.com'
    ? apiHost === 'api.github.com'
    : allowedHosts.has(apiHost);
  if (!allowed) {
    throw Object.assign(new Error(`Refusing to send ${kind} credentials to ${apiHost}; git remote host is ${remote.host}. Configure a machine-scoped trustedApiHostAliases entry only when both names identify the same SCM instance.`), { code: 'EAPIHOSTMISMATCH' });
  }
  if (remote.scheme === 'https' && api.protocol === 'http:') {
    throw Object.assign(new Error(`Refusing to downgrade SCM API transport from HTTPS remote ${remote.webOrigin} to plaintext ${api.origin}.`), { code: 'EAPITRANSPORTDOWNGRADE' });
  }
  return apiBaseUrl;
}

function validateApiBase(kind, value, allowInsecureHttp = false) {
  const url = assertSafeUrl(value, allowInsecureHttp);
  if (url.search || url.hash) throw Object.assign(new Error(`${kind} API base URL must not contain a query or fragment.`), { code: 'EAPIBASE' });
  const pathname = url.pathname.replace(/\/+$/, '');
  if (kind === 'gitlab' && !pathname.endsWith('/api/v4')) throw Object.assign(new Error('GitLab API base URL must end with /api/v4.'), { code: 'EAPIBASE' });
  if (kind === 'github' && normalizeHost(url.hostname) !== 'api.github.com' && !pathname.endsWith('/api/v3')) throw Object.assign(new Error('GitHub Enterprise API base URL must end with /api/v3.'), { code: 'EAPIBASE' });
  return `${url.origin}${pathname}`;
}

function defaultWebOrigin(remote, allowInsecureHttp = false) {
  if (remote.scheme === 'https') return remote.webOrigin;
  if (remote.scheme === 'http') {
    if (!allowInsecureHttp) throw Object.assign(new Error(`Plain HTTP git remote ${remote.webOrigin} requires safeCodexChange.allowInsecureHttp=true before deriving an API endpoint.`), { code: 'EINSECURESCM' });
    return remote.webOrigin;
  }
  return `https://${authorityFor(remote.host)}`;
}

function githubApiBase(remote, configuredBaseUrl = '', allowInsecureHttp = false) {
  const configured = String(configuredBaseUrl || '').trim().replace(/\/$/, '');
  if (remote.host === 'github.com') return validateApiBase('github', configured || GITHUB_CLOUD_API, allowInsecureHttp);
  if (configured && configured !== GITHUB_CLOUD_API) return validateApiBase('github', configured, allowInsecureHttp);
  return validateApiBase('github', `${defaultWebOrigin(remote, allowInsecureHttp)}/api/v3`, allowInsecureHttp);
}

function gitlabApiBase(remote, configuredBaseUrl = '', allowInsecureHttp = false) {
  const configured = String(configuredBaseUrl || '').trim().replace(/\/$/, '');
  return validateApiBase('gitlab', configured || `${defaultWebOrigin(remote, allowInsecureHttp)}/api/v4`, allowInsecureHttp);
}

function apiWebPrefix(apiBaseUrl, kind) {
  const pathname = new URL(apiBaseUrl).pathname.replace(/\/+$/, '');
  const suffix = kind === 'gitlab' ? '/api/v4' : '/api/v3';
  return pathname.endsWith(suffix) ? pathname.slice(0, -suffix.length).replace(/^\/+|\/+$/g, '') : '';
}

function normalizeRemoteForApi(remote, apiBaseUrl, kind) {
  if (!['http', 'https'].includes(remote.scheme)) return remote;
  const prefix = apiWebPrefix(apiBaseUrl, kind);
  if (!prefix) return remote;
  const path = String(remote.path || '');
  if (path !== prefix && !path.startsWith(`${prefix}/`)) return remote;
  const projectPath = path.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  const parts = projectPath.split('/').filter(Boolean);
  if (parts.length < 2) throw Object.assign(new Error(`SCM relative URL root ${prefix} leaves no valid repository path.`), { code: 'EREMOTEREPO' });
  return { ...remote, path: projectPath, owner: parts[0], repo: parts.at(-1), projectPath, repoFullName: projectPath };
}

function tokenFromEnvironment(name, fallback) {
  const envName = String(name || fallback || '').trim();
  if (!ENV_NAME.test(envName)) throw Object.assign(new Error(`Invalid SCM token environment variable name: ${envName || '<empty>'}`), { code: 'ETOKENENV' });
  const value = String(process.env[envName] || '');
  if (/[\r\n\0]/.test(value)) throw Object.assign(new Error(`${envName} contains invalid control characters.`), { code: 'ETOKENENV' });
  return { envName, value };
}

function assertSameScmTopology(sourceRemote, targetRemote) {
  if (normalizeHost(sourceRemote.host) !== normalizeHost(targetRemote.host)) {
    throw Object.assign(new Error('Cross-host source/target delivery is not supported; source and target must be on the same SCM instance.'), { code: 'ETOPOLOGYHOST' });
  }
  if (sourceRemote.webOrigin && targetRemote.webOrigin && sourceRemote.webOrigin !== targetRemote.webOrigin) {
    throw Object.assign(new Error(`Source/target remotes use different HTTP(S) origins (${sourceRemote.webOrigin} vs ${targetRemote.webOrigin}); treat them as different SCM instances unless the Git topology is normalized first.`), { code: 'ETOPOLOGYORIGIN' });
  }
}

function createProvider(remote, config, sourceRemote = remote) {
  const kind = detectProvider(remote, config);
  assertSameScmTopology(sourceRemote, remote);
  const timeoutMs = Math.max(3000, Number(config.requestTimeoutSeconds || 30) * 1000);
  const allowInsecureHttp = Boolean(config.allowInsecureHttp);
  const aliases = config.trustedApiHostAliases || {};
  if (kind === 'github') {
    const base = assertApiBoundToRemote(kind, remote, githubApiBase(remote, config.githubApiBaseUrl, allowInsecureHttp), aliases);
    const target = normalizeRemoteForApi(remote, base, kind);
    const source = normalizeRemoteForApi(sourceRemote, base, kind);
    const token = tokenFromEnvironment(config.githubTokenEnv, 'GITHUB_TOKEN');
    return new GitHubProvider({ remote: target, sourceRemote: source, apiBaseUrl: base, token: token.value, timeoutMs, allowInsecureHttp, tokenEnvName: token.envName });
  }
  const base = assertApiBoundToRemote(kind, remote, gitlabApiBase(remote, config.gitlabApiBaseUrl, allowInsecureHttp), aliases);
  const target = normalizeRemoteForApi(remote, base, kind);
  const source = normalizeRemoteForApi(sourceRemote, base, kind);
  const token = tokenFromEnvironment(config.gitlabTokenEnv, 'GITLAB_TOKEN');
  return new GitLabProvider({ remote: target, sourceRemote: source, apiBaseUrl: base, token: token.value, timeoutMs, allowInsecureHttp, tokenEnvName: token.envName });
}

module.exports = { createProvider, assertApiBoundToRemote, validateApiBase, defaultWebOrigin, githubApiBase, gitlabApiBase, apiWebPrefix, normalizeRemoteForApi, tokenFromEnvironment, aliasHosts, assertSameScmTopology, GITHUB_CLOUD_API };
