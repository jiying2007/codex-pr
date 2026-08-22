'use strict';

const { runPreparedProcess } = require('./process');
const { normalizeRef, chooseDetectedBase, splitRemoteBranch, parseGitHubRemote, sameGitHubRepo } = require('./core');

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

async function remoteHeadFor(root, remote, token) {
  if (!remote) return '';
  try {
    const { stdout } = await git(root, ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`], {}, token);
    return normalizeRef(stdout.trim());
  } catch {
    return '';
  }
}

async function listBranchRefs(root, token) {
  const { stdout } = await git(root, ['for-each-ref', '--format=%(refname)%09%(refname:short)%09%(objectname)', 'refs/heads', 'refs/remotes'], { maxStdoutBytes: 2 * 1024 * 1024 }, token);
  const items = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [fullName, shortName, oid] = line.split('\t');
    if (!fullName || !shortName || !oid || shortName.endsWith('/HEAD')) continue;
    items.push({ name: normalizeRef(shortName), oid, kind: fullName.startsWith('refs/remotes/') ? 'remote' : 'local' });
  }
  return items;
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
      const raw = stdout.trim();
      result.set(remote, { raw, github: parseGitHubRemote(raw) });
    } catch {}
  }
  return result;
}

function isForkTopology(remotes) {
  const origin = remotes.get('origin')?.github || null;
  const upstream = remotes.get('upstream')?.github || null;
  return Boolean(upstream && (!origin || !sameGitHubRepo(origin, upstream)));
}

async function detectBase(root, configuredBase, token) {
  const branch = await currentBranch(root, token);
  const [refs, remotes] = await Promise.all([listBranchRefs(root, token), getRemoteUrls(root, token)]);
  const [originHead, upstreamHead] = await Promise.all([
    remotes.has('origin') ? remoteHeadFor(root, 'origin', token) : Promise.resolve(''),
    remotes.has('upstream') ? remoteHeadFor(root, 'upstream', token) : Promise.resolve('')
  ]);
  const forkTopology = isForkTopology(remotes);
  const candidate = chooseDetectedBase({ configuredBase, originHead, upstreamHead, refs, currentBranch: branch, forkTopology });
  return { branch, refs, candidate, originHead, upstreamHead, forkTopology, remoteNames: [...remotes.keys()] };
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

function validateHeadPath(relativePath) {
  const p = String(relativePath || '').replace(/\\/g, '/');
  if (!p || p.startsWith('/') || p.split('/').some(part => part === '..' || part === '')) throw new Error(`Invalid repository-relative path: ${relativePath}`);
  return p;
}

async function readHeadBlob(root, relativePath, maxBytes, token) {
  const safePath = validateHeadPath(relativePath);
  const { stdout: tree } = await git(root, ['ls-tree', '-z', 'HEAD', '--', safePath], { maxStdoutBytes: 64 * 1024 }, token);
  const record = tree.split('\0').find(Boolean);
  if (!record) return null;
  const match = record.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/);
  if (!match) throw new Error(`Unable to parse HEAD tree entry for ${safePath}.`);
  const [, mode, type, oid, actualPath] = match;
  if (actualPath !== safePath || type !== 'blob') return null;
  if (mode === '120000') return { path: safePath, mode, oid, symlink: true, text: '' };
  if (!/^100\d{3}$/.test(mode)) return null;
  const { stdout: sizeText } = await git(root, ['cat-file', '-s', oid], { maxStdoutBytes: 1024 }, token);
  const size = Number(sizeText.trim());
  if (!Number.isFinite(size) || size < 0) throw new Error(`Unable to determine HEAD blob size for ${safePath}.`);
  if (size > maxBytes) return { path: safePath, mode, oid, tooLarge: true, size, text: '' };
  const { stdout: text } = await git(root, ['cat-file', 'blob', oid], { maxStdoutBytes: maxBytes + 1 }, token);
  if (Buffer.byteLength(text, 'utf8') > maxBytes) return { path: safePath, mode, oid, tooLarge: true, size: Buffer.byteLength(text, 'utf8'), text: '' };
  return { path: safePath, mode, oid, size, text };
}

async function readPullRequestTemplate(root, token) {
  const candidates = [
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/pull_request_template.md'
  ];
  for (const relative of candidates) {
    const blob = await readHeadBlob(root, relative, 64 * 1024, token);
    if (!blob || blob.symlink || blob.tooLarge) continue;
    return blob.text;
  }
  return '';
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
  const [commitsResult, statResult, statusResult, diffResult, dirty, templateText] = await Promise.all([
    git(root, ['log', '--no-decorate', '--date=short', '--format=%h%x09%ad%x09%s', range], { maxStdoutBytes: options.maxCommitBytes + 1 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--stat', base, 'HEAD'], { maxStdoutBytes: 512 * 1024 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--name-status', base, 'HEAD'], { maxStdoutBytes: 512 * 1024 }, token),
    git(root, ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', '--unified=3', base, 'HEAD', '--'], { maxStdoutBytes: options.maxDiffBytes + 1 }, token),
    localDirty(root, token),
    options.includePullRequestTemplate ? readPullRequestTemplate(root, token) : Promise.resolve('')
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

async function configValue(root, key, token) {
  try {
    const { stdout } = await git(root, ['config', '--get', key], {}, token);
    return stdout.trim();
  } catch {
    return '';
  }
}

async function currentTrackingRemote(root, branch, token) {
  const value = await configValue(root, `branch.${branch}.remote`, token);
  return value && value !== '.' ? value : '';
}

async function currentPushRemote(root, branch, remotes, token) {
  const candidates = [
    await configValue(root, `branch.${branch}.pushRemote`, token),
    await configValue(root, 'remote.pushDefault', token),
    await currentTrackingRemote(root, branch, token),
    'origin',
    ...remotes.keys()
  ];
  for (const candidate of candidates) if (candidate && candidate !== '.' && remotes.has(candidate)) return candidate;
  return '';
}

async function remoteHasBranch(root, remote, branch, token) {
  if (!remote || !branch) return false;
  try {
    await refOid(root, `${remote}/${branch}`, token);
    return true;
  } catch {
    return false;
  }
}

async function isHeadPublished(root, remote, branch, token) {
  if (!remote) return false;
  try {
    const [head, published] = await Promise.all([refOid(root, 'HEAD', token), refOid(root, `${remote}/${branch}`, token)]);
    return head === published;
  } catch {
    return false;
  }
}

async function resolveBaseRemoteName(root, baseRef, remotes, token) {
  const split = splitRemoteBranch(baseRef, remotes.keys());
  if (split.remote) return { remote: split.remote, branch: split.branch };

  const branch = split.branch;
  const tracking = await currentTrackingRemote(root, branch, token);
  const forkTopology = isForkTopology(remotes);
  const candidates = forkTopology
    ? ['upstream', tracking, 'origin', ...remotes.keys()]
    : [tracking, 'origin', 'upstream', ...remotes.keys()];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate) || !remotes.has(candidate)) continue;
    seen.add(candidate);
    if (await remoteHasBranch(root, candidate, branch, token)) return { remote: candidate, branch };
  }
  return { remote: '', branch };
}

async function resolveGitHubOpenContext(root, baseRef, headBranch, token) {
  const remotes = await getRemoteUrls(root, token);
  const base = await resolveBaseRemoteName(root, baseRef, remotes, token);
  const headRemoteName = await currentPushRemote(root, headBranch, remotes, token);
  const baseRemote = base.remote ? remotes.get(base.remote)?.github || null : null;
  const headRemote = headRemoteName ? remotes.get(headRemoteName)?.github || null : null;
  const published = await isHeadPublished(root, headRemoteName, headBranch, token);
  return {
    baseRemoteName: base.remote,
    baseRemote,
    baseBranch: base.branch,
    headRemoteName,
    headRemote,
    headBranch,
    published
  };
}

module.exports = {
  git,
  resolveGitRoot,
  currentBranch,
  refOid,
  remoteHeadFor,
  listBranchRefs,
  getRemoteUrls,
  isForkTopology,
  detectBase,
  aheadCount,
  mergeBase,
  repositorySnapshot,
  localDirty,
  readHeadBlob,
  readPullRequestTemplate,
  collectPrContext,
  currentTrackingRemote,
  currentPushRemote,
  remoteHasBranch,
  isHeadPublished,
  resolveBaseRemoteName,
  resolveGitHubOpenContext
};