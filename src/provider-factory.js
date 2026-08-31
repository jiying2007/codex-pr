'use strict';
const { detectProvider } = require('./remote');
const { GitHubProvider } = require('./providers/github');
const { GitLabProvider } = require('./providers/gitlab');
const GITHUB_CLOUD_API = 'https://api.github.com';
function assertApiBoundToRemote(kind, remote, apiBaseUrl) {
  const api = new URL(apiBaseUrl); const apiHost = api.hostname.toLowerCase(); const remoteHost = remote.host.toLowerCase();
  const allowed = kind === 'github' && remoteHost === 'github.com' ? apiHost === 'api.github.com' : apiHost === remoteHost;
  if (!allowed) { const error = new Error(`Refusing to send ${kind} credentials to ${apiHost}; git remote host is ${remoteHost}.`); error.code = 'EAPIHOSTMISMATCH'; throw error; }
  return apiBaseUrl;
}
function githubApiBase(remote, configuredBaseUrl = '') {
  const configured = String(configuredBaseUrl || '').trim().replace(/\/$/, '');
  if (remote.host === 'github.com') return configured || GITHUB_CLOUD_API;
  if (!configured || configured === GITHUB_CLOUD_API) return `https://${remote.host}/api/v3`;
  return configured;
}
function createProvider(remote, config) {
  const kind = detectProvider(remote, config); const timeoutMs = Math.max(3000, Number(config.requestTimeoutSeconds || 30) * 1000); const allowInsecureHttp = Boolean(config.allowInsecureHttp);
  if (kind === 'github') {
    const base = assertApiBoundToRemote(kind, remote, githubApiBase(remote, config.githubApiBaseUrl));
    return new GitHubProvider({ remote, apiBaseUrl: base, token: process.env[config.githubTokenEnv || 'GITHUB_TOKEN'] || '', timeoutMs, allowInsecureHttp });
  }
  const base = assertApiBoundToRemote(kind, remote, config.gitlabApiBaseUrl || `https://${remote.host}/api/v4`);
  return new GitLabProvider({ remote, apiBaseUrl: base, token: process.env[config.gitlabTokenEnv || 'GITLAB_TOKEN'] || '', timeoutMs, allowInsecureHttp });
}
module.exports = { createProvider, assertApiBoundToRemote, githubApiBase, GITHUB_CLOUD_API };
