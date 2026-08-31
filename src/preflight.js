'use strict';
const { parseRemote } = require('./remote');

function finding(code, message, details = {}) { return { code, message, ...details }; }
async function locateCodeowners(git, targetRef) {
  for (const path of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
    const text = await git.showFile(targetRef, path); if (text) return { path, text };
  }
  return null;
}
async function runPreflight({ git, config, provider }) {
  const blockers = [], warnings = [];
  const remoteName = config.remote || 'origin';
  const sourceBranch = await git.currentBranch();
  if (!sourceBranch) blockers.push(finding('detached_head', 'HEAD is detached; delivery requires a named source branch.'));
  const targetBranch = String(config.targetBranch || 'main').trim();
  if (sourceBranch === targetBranch) blockers.push(finding('source_is_target', `Source branch is the target branch (${targetBranch}).`));
  const headSha = await git.revParse('HEAD');
  if (provider.hasToken === false) blockers.push(finding('scm_credentials_missing', 'SCM API token is not available in the configured environment variable; remote delivery writes cannot be authorized.'));
  const remoteUrl = await git.remoteUrl(remoteName); const remote = parseRemote(remoteUrl);
  const targetRef = git.trackingRef(remoteName, targetBranch);
  const localTargetSha = await git.revParse(targetRef).catch(() => '');
  if (!localTargetSha) blockers.push(finding('target_ref_missing', `Local target tracking ref ${targetRef} is missing; fetch ${remoteName} before delivery.`));
  const mergeBase = localTargetSha ? await git.mergeBase(targetRef, 'HEAD').catch(() => '') : '';
  if (!mergeBase) blockers.push(finding('merge_base_missing', `Cannot determine merge-base between ${targetRef} and HEAD.`));
  const commits = mergeBase ? await git.commits(`${mergeBase}..HEAD`) : [];
  if (!commits.length) blockers.push(finding('no_commits', `No committed changes exist relative to ${targetRef}.`));
  const changedFiles = mergeBase ? await git.changedFiles(`${mergeBase}...HEAD`) : [];
  const status = await git.statusPorcelain();
  if (config.requireCleanWorktree !== false && status) blockers.push(finding('dirty_worktree', 'Working tree or index contains uncommitted changes; PR/MR evidence is committed-only.'));
  else if (status) warnings.push(finding('dirty_worktree_allowed', 'Working tree contains changes that are intentionally excluded from this delivery snapshot.'));
  const upstream = await git.upstream();
  if (!upstream) warnings.push(finding('upstream_missing', 'Current branch has no configured upstream tracking branch.'));
  let providerCompatibility = null;
  if (typeof provider.validateCompatibility === 'function') {
    try { providerCompatibility = await provider.validateCompatibility(); } catch (error) { blockers.push(finding('provider_incompatible', error.message)); }
  }
  let remoteHeadSha = '', remoteTargetSha = '';
  try { [remoteHeadSha, remoteTargetSha] = await Promise.all([provider.getBranchSha(sourceBranch), provider.getBranchSha(targetBranch)]); }
  catch (error) { blockers.push(finding('remote_preflight_failed', `Remote preflight failed: ${error.message}`)); }
  if (config.requirePushedHead !== false && remoteHeadSha && remoteHeadSha !== headSha) blockers.push(finding('head_not_pushed', `Remote ${sourceBranch} does not match local HEAD.`, { local: headSha, remote: remoteHeadSha }));
  else if (remoteHeadSha && remoteHeadSha !== headSha) warnings.push(finding('head_not_pushed_allowed', 'Remote source branch differs from local HEAD.'));
  if (config.requireFreshTarget !== false && remoteTargetSha && localTargetSha && remoteTargetSha !== localTargetSha) blockers.push(finding('target_ref_stale', `Local ${targetRef} is stale relative to the server.`, { local: localTargetSha, remote: remoteTargetSha }));
  else if (remoteTargetSha && localTargetSha && remoteTargetSha !== localTargetSha) warnings.push(finding('target_ref_stale_allowed', `Local ${targetRef} differs from remote target.`));
  const state = blockers.length ? 'BLOCKED' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY';
  return { state, blockers, warnings, remote, remoteName, sourceBranch, targetBranch, headSha, localTargetSha, targetSha: remoteTargetSha || localTargetSha, remoteHeadSha, mergeBase, commits, changedFiles, providerCompatibility, codeowners: localTargetSha ? await locateCodeowners(git, targetRef) : null };
}
module.exports = { runPreflight, locateCodeowners };
