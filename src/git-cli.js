'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { assertSafeGitToken } = require('./codex-safe-core/git-repository');
const execFileAsync = promisify(execFile);

function safeToken(value, name) {
  try { return assertSafeGitToken(String(value || ''), name); }
  catch (cause) { throw Object.assign(new Error(`${name} is invalid.`), { code: 'EGITTOKEN', cause }); }
}

function parseNameStatusZ(value) {
  const tokens = String(value || '').split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const raw = tokens[index++];
    if (!raw) throw Object.assign(new Error('Git name-status output contains an empty status token.'), { code: 'EGITOUTPUT' });
    const status = raw[0];
    if (status === 'R' || status === 'C') {
      if (index + 1 >= tokens.length) throw Object.assign(new Error('Git rename/copy output is truncated.'), { code: 'EGITOUTPUT' });
      const oldPath = tokens[index++], path = tokens[index++];
      files.push({ status, path, oldPath });
    } else {
      if (index >= tokens.length) throw Object.assign(new Error('Git name-status output is truncated.'), { code: 'EGITOUTPUT' });
      files.push({ status, path: tokens[index++] });
    }
  }
  return files;
}

class GitCli {
  constructor(cwd) { this.cwd = cwd; }
  async run(args, { allowFailure = false, signal } = {}) {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' }, signal
      });
      return stdout.trimEnd();
    } catch (error) {
      if (allowFailure) return '';
      error.code = error.code || 'EGIT';
      error.gitArgs = args;
      throw error;
    }
  }
  revParse(ref) { return this.run(['rev-parse', '--verify', safeToken(ref, 'Git ref')]); }
  currentBranch() { return this.run(['branch', '--show-current']); }
  statusPorcelain() { return this.run(['status', '--porcelain=v1', '--untracked-files=all']); }
  remoteUrl(remote) { return this.run(['remote', 'get-url', safeToken(remote, 'Git remote name')]); }
  mergeBase(a, b) { return this.run(['merge-base', safeToken(a, 'merge-base ref'), safeToken(b, 'merge-base ref')]); }
  upstream() { return this.run(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFailure: true }); }
  async remoteDefaultBranch(remote) {
    const safeRemote = safeToken(remote, 'Git remote name');
    const ref = await this.run(['symbolic-ref', '--short', `refs/remotes/${safeRemote}/HEAD`], { allowFailure: true });
    return ref.startsWith(`${safeRemote}/`) ? ref.slice(safeRemote.length + 1) : '';
  }
  async commits(range) {
    const t = await this.run(['log', '--format=%H%x09%s', '--first-parent', safeToken(range, 'commit range')]);
    return t ? t.split('\n').map(line => { const [sha, ...rest] = line.split('\t'); return { sha, subject: rest.join('\t') }; }) : [];
  }
  async changedFiles(range) {
    const t = await this.run(['diff', '--name-status', '-z', '--find-renames', '--find-copies', safeToken(range, 'diff range')]);
    return t ? parseNameStatusZ(`${t}\0`) : [];
  }
  showFile(ref, filePath) {
    const safeRef = safeToken(ref, 'Git ref');
    if (typeof filePath !== 'string' || !filePath || /[\0\r\n]/.test(filePath)) throw Object.assign(new Error('Git file path is invalid.'), { code: 'EGITTOKEN' });
    return this.run(['show', `${safeRef}:${filePath}`], { allowFailure: true });
  }
  trackingRef(remote, branch) { return `${safeToken(remote, 'Git remote name')}/${safeToken(branch, 'Git branch')}`; }
}

module.exports = { GitCli, parseNameStatusZ, safeToken };
