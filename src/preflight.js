'use strict';

const { parseRemote } = require('./remote');

function finding(code, message, details = {}) { return { code, message, ...details }; }

const CODEOWNERS_PATHS = Object.freeze({
  github: Object.freeze(['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']),
  gitlab: Object.freeze(['CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'])
});

async function locateCodeowners(git, targetRef, providerKind = 'github') {
  for (const filePath of CODEOWNERS_PATHS[providerKind] || CODEOWNERS_PATHS.github) {
    const text = await git.showFile(targetRef, filePath);
    if (text) return { path: filePath, text, provider: providerKind };
  }
  return null;
}

function scmFailure(error, phase = 'SCM request') {
  const status = Number(error?.status || 0);
  const causeCode = String(error?.cause?.code || error?.cause?.cause?.code || '').toUpperCase();
  if (error?.code === 'EINSECURESCM') return finding('scm_insecure_http_blocked', error.message);
  if (error?.code === 'EPUBLICPLAINTEXTSCM') return finding('scm_public_plaintext_blocked', error.message);
  if (error?.code === 'EAPIHOSTMISMATCH') return finding('scm_api_host_mismatch', error.message);
  if (error?.code === 'EAPITRANSPORTDOWNGRADE') return finding('scm_api_transport_downgrade', error.message);
  if (error?.code === 'EAPIBASE') return finding('scm_api_base_invalid', error.message);
  if (error?.code === 'ETOKENENV') return finding('scm_token_env_invalid', error.message);
  if (error?.code === 'ESCMHTTP' && status === 401) return finding('scm_auth_failed', `${phase} was rejected with HTTP 401; verify the configured token environment variable.`);
  if (error?.code === 'ESCMHTTP' && status === 403) return finding('scm_permission_denied', `${phase} was rejected with HTTP 403; verify token scope and project permissions.`);
  if (error?.code === 'ESCMNETWORK' && ['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(causeCode)) return finding('scm_tls_failed', `${phase} failed TLS verification (${causeCode}); configure the corporate CA with NODE_EXTRA_CA_CERTS instead of disabling TLS verification.`);
  if (error?.code === 'ESCMNETWORK' && ['ENOTFOUND', 'EAI_AGAIN'].includes(causeCode)) return finding('scm_dns_failed', `${phase} could not resolve the SCM host (${causeCode}).`);
  if (error?.code === 'ESCMNETWORK' && ['ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(causeCode)) return finding('scm_network_failed', `${phase} could not reach the SCM API (${causeCode}).`);
  if (error?.code === 'EGITLABVERSION') return finding('provider_incompatible', error.message);
  return finding('remote_preflight_failed', `${phase} failed: ${error?.message || error}`);
}

async function runPreflight({ git, config, provider }) {
  const blockers = [], warnings = [];
  const sourceRemoteName = config.sourceRemote || 'origin', targetRemoteName = config.targetRemote || sourceRemoteName;
  const sourceBranch = await git.currentBranch();
  if (!sourceBranch) blockers.push(finding('detached_head', 'HEAD is detached; delivery requires a named source branch.'));
  const targetBranch = String(config.targetBranch || '').trim();
  if (!targetBranch) blockers.push(finding('target_branch_unknown', 'Target branch could not be resolved.'));
  const headSha = await git.revParse('HEAD');
  if (provider.hasToken === false) blockers.push(finding('scm_credentials_missing', `SCM API token is not available in ${provider.tokenEnvName || 'the configured environment variable'}; remote delivery writes cannot be authorized.`));
  if (String(provider?.client?.baseUrl || '').startsWith('http://')) warnings.push(finding('scm_plaintext_http', 'SCM API is using plaintext HTTP. The GitLab/GitHub token and API payloads are not protected from observers on the network; use only on an explicitly trusted isolated LAN and migrate to HTTPS when possible.'));

  const [sourceUrl, targetUrl] = await Promise.all([git.remoteUrl(sourceRemoteName), git.remoteUrl(targetRemoteName)]);
  const sourceRemote = parseRemote(sourceUrl), targetRemote = parseRemote(targetUrl);
  if (sourceBranch && targetBranch && sourceBranch === targetBranch && sourceRemote.host === targetRemote.host && sourceRemote.projectPath === targetRemote.projectPath) blockers.push(finding('source_is_target', `Source branch is the target branch (${targetBranch}) in the same repository.`));

  const targetRef = targetBranch ? git.trackingRef(targetRemoteName, targetBranch) : '';
  const localTargetSha = targetBranch ? await git.revParse(targetRef).catch(() => '') : '';
  if (targetBranch && !localTargetSha) blockers.push(finding('target_ref_missing', `Local target tracking ref ${targetRef} is missing; fetch ${targetRemoteName} before delivery.`));
  const mergeBase = localTargetSha ? await git.mergeBase(targetRef, 'HEAD').catch(() => '') : '';
  if (localTargetSha && !mergeBase) blockers.push(finding('merge_base_missing', `Cannot determine merge-base between ${targetRef} and HEAD.`));
  const commits = mergeBase ? await git.commits(`${mergeBase}..HEAD`) : [];
  if (mergeBase && !commits.length) blockers.push(finding('no_commits', `No committed changes exist relative to ${targetRef}.`));
  const changedFiles = mergeBase ? await git.changedFiles(`${mergeBase}...HEAD`) : [];
  const status = await git.statusPorcelain();
  if (config.requireCleanWorktree !== false && status) blockers.push(finding('dirty_worktree', 'Working tree or index contains uncommitted changes; delivery evidence is committed-only.'));
  else if (status) warnings.push(finding('dirty_worktree_allowed', 'Working tree contains changes intentionally excluded from this delivery snapshot.'));
  const upstream = await git.upstream();
  if (!upstream) warnings.push(finding('upstream_missing', 'Current branch has no configured upstream tracking branch.'));

  let providerCompatibility = null, remoteHeadSha = '', remoteTargetSha = '';
  if (provider.hasToken !== false) {
    if (typeof provider.validateCompatibility === 'function') {
      try { providerCompatibility = await provider.validateCompatibility(); }
      catch (error) { blockers.push(scmFailure(error, 'Provider compatibility check')); }
    }
    try {
      [remoteHeadSha, remoteTargetSha] = await Promise.all([
        sourceBranch ? provider.getSourceBranchSha(sourceBranch) : Promise.resolve(''),
        targetBranch ? provider.getTargetBranchSha(targetBranch) : Promise.resolve('')
      ]);
    } catch (error) { blockers.push(scmFailure(error, 'Remote branch snapshot')); }
  }

  if (config.requirePushedHead !== false && remoteHeadSha && remoteHeadSha !== headSha) blockers.push(finding('head_not_pushed', `Remote ${sourceRemoteName}/${sourceBranch} does not match local HEAD.`, { local: headSha, remote: remoteHeadSha }));
  else if (remoteHeadSha && remoteHeadSha !== headSha) warnings.push(finding('head_not_pushed_allowed', 'Remote source branch differs from local HEAD.'));
  if (config.requireFreshTarget !== false && remoteTargetSha && localTargetSha && remoteTargetSha !== localTargetSha) blockers.push(finding('target_ref_stale', `Local ${targetRef} is stale relative to the server.`, { local: localTargetSha, remote: remoteTargetSha }));
  else if (remoteTargetSha && localTargetSha && remoteTargetSha !== localTargetSha) warnings.push(finding('target_ref_stale_allowed', `Local ${targetRef} differs from remote target.`));

  const state = blockers.length ? 'BLOCKED' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY';
  return {
    state, blockers, warnings, remote: provider.targetRemote || targetRemote, sourceRemote: provider.sourceRemote || sourceRemote, targetRemote: provider.targetRemote || targetRemote,
    sourceRemoteName, targetRemoteName, sourceBranch, targetBranch, headSha, localTargetSha, targetSha: remoteTargetSha || localTargetSha,
    remoteHeadSha, mergeBase, commits, changedFiles, providerCompatibility, policySource: config.policySource || 'local',
    codeowners: localTargetSha ? await locateCodeowners(git, targetRef, provider.kind) : null
  };
}

module.exports = { CODEOWNERS_PATHS, runPreflight, locateCodeowners, scmFailure };
