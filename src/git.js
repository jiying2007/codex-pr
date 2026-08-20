'use strict';

const fs = require('fs');
const path = require('path');
const { runPreparedProcess } = require('./process');
const { normalizeRef, chooseDetectedBase, splitRemoteBranch, parseGitHubRemote } = require('./core');

async function git(root, args, options = {}, token) {
  return runPreparedProcess('git', ['-C', root, ...args], {
    timeoutMs: options.timeoutMs || 20000,
    maxStdoutBytes: options.maxStdoutBytes,
    maxStderrBytes: options.maxStderrBytes || 1024 * 1024
  }, '', token);
}

async function resolveGitRoot(folderPath, token) {
  try {
    const { stdout } = await git(folderPath, ['rev-parse', '--show-toplevel'], {}, token);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function currentBranch(root, token) {
  try {
    const { stdout } = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {}, token);
    return stdout.trim();
  } catch {
    const error = new Error('Detached HEAD is not supported. Check out a branch before generating a pull request.');
    error.code = 'EDETACHEDHEAD';
    throw error;
  }
}

async function refOid(root, ref, token) {
  const { stdout } = await git(root, ['rev-parse', '--verify', `${ref}^{commit}`], {}, token);
  return stdout.trim();
}

async function remoteHead(root, token) {
  for (const ref of ['refs/remotes/origin/HEAD', 'refs/remotes/upstream/HEAD']) {
    try {
      const { stdout } = await git(root, ['symbolic-ref', '--quiet', '--short', ref], {}, token);
      if (stdout.trim()) return normalizeRef(stdout.trim());
    } catch {}
  }
  return '';
}

async function listBranchRefs(root, token) {
  const { stdout } = await git(root, ['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads', 'refs/remotes'], { maxStdoutBytes: 2 * 1024 * 1024 }, token);
  const items = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, oid] = line.split('\t');
    if (!name || !oid || name.endsWith('/HEAD')) continue;
    items.push({ name: normalizeRef(name), oid });
  }
  return items;
}

async function detectBase(root, configuredBase, token) {
  const [branch, rHead, refs] = await Promise.all([currentBranch(root, token), remoteHead(root, token), listBranchRefs(root, token)]);
  const candidate = chooseDetectedBase({ configuredBase, remoteHead: rHead, refs, currentBranch: branch });
  return { branch, remoteHead: rHead, refs, candidate };
}

async function aheadCount(root, baseRef, token) {
  const { stdout } = await git(root, ['rev-list', '--count', `${baseRef}..HEAD`], {}, token);
  return Number(stdout.trim()) || 0;
}

async function mergeBase(root, baseRef, token) {
  const { stdout } = await git(root, ['merge-base', baseRef, 'HEAD'], {}, token);
  return stdout.trim();
}

async function repositorySnapshot(root, baseRef, token) {
  const [headOid, baseOid] = await Promise.all([refOid(root, 'HEAD', token), refOid(root, baseRef, token)]);
  return { headOid, baseOid, baseRef: normalizeRef(baseRef) };
}

async function localDirty(root, token) {
  const { stdout } = await git(root, ['status', '--porcelain=v2', '-z'], { maxStdoutBytes: 2 * 1024 * 1024 }, token);
  return stdout.length > 0;
}

async function collectPrContext(root, baseRef, options, token) {
  const headBranch = await currentBranch(root, token);
  const snapshot = await repositorySnapshot(root, baseRef, token);
  const count = await aheadCount(root, baseRef, token);
  if (count < 1) {
    const error = new Error(`No commits exist in ${baseRef}..${headBranch}.`);
    error.code = 'ENOCHANGES';
    throw error;
  }

  const base = await mergeBase(root, baseRef, token);
  const range = `${base}..HEAD`;
  const [commitsResult, statResult, statusResult, diffResult, dirty] = await Promise.all([
    git(root, ['log', '--no-decorate', '--date=short', '--format=%h%x09%ad%x09%s', range], { maxStdoutBytes: options.maxCommitBytes + 1 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--stat', base, 'HEAD'], { maxStdoutBytes: 512 * 1024 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--name-status', base, 'HEAD'], { maxStdoutBytes: 512 * 1024 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--unified=3', base, 'HEAD', '--'], { maxStdoutBytes: options.maxDiffBytes + 1 }, token),
    localDirty(root, token)
  ]);

  if (Buffer.byteLength(commitsResult.stdout, 'utf8') > options.maxCommitBytes) {
    const error = new Error(`Commit list exceeds maxCommitBytes (${options.maxCommitBytes}).`);
    error.code = 'ECOMMITTOOLARGE';
    throw error;
  }
  if (Buffer.byteLength(diffResult.stdout, 'utf8') > options.maxDiffBytes) {
    const error = new Error(`PR diff exceeds maxDiffBytes (${options.maxDiffBytes}). Increase safeCodexPr.maxDiffBytes after reviewing the PR size.`);
    error.code = 'EDIFFTOOLARGE';
    throw error;
  }
  if (!diffResult.stdout.trim() && !statusResult.stdout.trim()) {
    const error = new Error('The selected PR range contains no file changes.');
    error.code = 'ENOCHANGES';
    throw error;
  }

  let templateText = '';
  if (options.includePullRequestTemplate) templateText = readPullRequestTemplate(root);

  return {
    root,
    baseRef: normalizeRef(baseRef),
    baseMergeOid: base,
    baseOid: snapshot.baseOid,
    headOid: snapshot.headOid,
    headBranch,
    aheadCount: count,
    commits: commitsResult.stdout.trim(),
    diffStat: statResult.stdout.trim(),
    nameStatus: statusResult.stdout.trim(),
    diff: diffResult.stdout,
    localDirty: dirty,
    templateText
  };
}

function readPullRequestTemplate(root) {
  const candidates = [
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/pull_request_template.md'
  ];
  for (const relative of candidates) {
    const file = path.join(root, relative);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > 64 * 1024) continue;
      return fs.readFileSync(file, 'utf8').slice(0, 64 * 1024);
    } catch {}
  }
  return '';
}

async function getRemoteUrls(root, token) {
  const result = new Map();
  let remotes = [];
  try {
    const { stdout } = await git(root, ['remote'], {}, token);
    remotes = stdout.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  } catch {}
  for (const remote of remotes) {
    try {
      const { stdout } = await git(root, ['remote', 'get-url', remote], {}, token);
      const parsed = parseGitHubRemote(stdout.trim());
      result.set(remote, { raw: stdout.trim(), github: parsed });
    } catch {}
  }
  return result;
}

async function currentTrackingRemote(root, branch, token) {
  try {
    const { stdout } = await git(root, ['config', '--get', `branch.${branch}.remote`], {}, token);
    const value = stdout.trim();
    return value && value !== '.' ? value : 'origin';
  } catch {
    return 'origin';
  }
}

async function isHeadPublished(root, remote, branch, token) {
  try {
    const [head, published] = await Promise.all([refOid(root, 'HEAD', token), refOid(root, `${remote}/${branch}`, token)]);
    return head === published;
  } catch {
    return false;
  }
}

async function resolveGitHubOpenContext(root, baseRef, headBranch, token) {
  const remotes = await getRemoteUrls(root, token);
  const baseSplit = splitRemoteBranch(baseRef);
  const baseRemoteName = baseSplit.remote && remotes.has(baseSplit.remote) ? baseSplit.remote : (remotes.has('upstream') && baseSplit.remote === 'upstream' ? 'upstream' : 'origin');
  const baseBranch = baseSplit.branch;
  const headRemoteName = await currentTrackingRemote(root, headBranch, token);
  const baseRemote = remotes.get(baseRemoteName)?.github || remotes.get('origin')?.github || null;
  const headRemote = remotes.get(headRemoteName)?.github || remotes.get('origin')?.github || null;
  const published = await isHeadPublished(root, headRemoteName, headBranch, token);
  return { baseRemoteName, baseRemote, baseBranch, headRemoteName, headRemote, headBranch, published };
}

module.exports = {
  git,
  resolveGitRoot,
  currentBranch,
  refOid,
  remoteHead,
  listBranchRefs,
  detectBase,
  aheadCount,
  mergeBase,
  repositorySnapshot,
  localDirty,
  collectPrContext,
  readPullRequestTemplate,
  getRemoteUrls,
  currentTrackingRemote,
  isHeadPublished,
  resolveGitHubOpenContext
};
