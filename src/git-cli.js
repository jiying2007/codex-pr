'use strict';

const { execFile } = require('node:child_process');
const { promisify, TextDecoder } = require('node:util');
const { assertSafeGitToken, DEFAULT_GIT_TIMEOUT_MS } = require('./codex-safe-core/git-repository');
const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

function safeToken(value, name) {
  try { return assertSafeGitToken(String(value || ''), name); }
  catch (cause) { throw Object.assign(new Error(`${name} is invalid.`), { code: 'EGITTOKEN', cause }); }
}

function parseNameStatusZ(value) {
  if (value === '') return [];
  if (typeof value !== 'string' || !value.endsWith('\0')) {
    throw Object.assign(new Error('Git name-status output is not NUL-terminated.'), { code: 'EGITOUTPUT' });
  }
  const tokens = value.slice(0, -1).split('\0');
  const files = [];
  for (let index = 0; index < tokens.length;) {
    const raw = tokens[index++];
    if (!/^[ACDMRTUXB](?:\d{1,3})?$/.test(raw)) throw Object.assign(new Error('Git name-status output contains an invalid status token.'), { code: 'EGITOUTPUT' });
    const status = raw[0];
    if (status === 'R' || status === 'C') {
      if (index + 1 >= tokens.length) throw Object.assign(new Error('Git rename/copy output is truncated.'), { code: 'EGITOUTPUT' });
      const oldPath = tokens[index++], path = tokens[index++];
      if (!oldPath || !path) throw Object.assign(new Error('Git rename/copy output contains an empty path.'), { code: 'EGITOUTPUT' });
      files.push({ status, path, oldPath });
    } else {
      if (index >= tokens.length) throw Object.assign(new Error('Git name-status output is truncated.'), { code: 'EGITOUTPUT' });
      const path = tokens[index++];
      if (!path) throw Object.assign(new Error('Git name-status output contains an empty path.'), { code: 'EGITOUTPUT' });
      files.push({ status, path });
    }
  }
  return files;
}

class GitCli {
  constructor(cwd) { this.cwd = cwd; }
  async runBuffer(args, { allowFailure = false, signal, maxStdoutBytes = MAX_GIT_OUTPUT_BYTES } = {}) {
    if (!Number.isSafeInteger(maxStdoutBytes) || maxStdoutBytes < 1 || maxStdoutBytes > MAX_GIT_OUTPUT_BYTES) {
      throw new RangeError('Git output limit must be a positive byte count within the process bound.');
    }
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.cwd, encoding: 'buffer', windowsHide: true, maxBuffer: maxStdoutBytes,
        timeout: DEFAULT_GIT_TIMEOUT_MS,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }, signal
      });
      return stdout;
    } catch (error) {
      if (allowFailure) return Buffer.alloc(0);
      error.code = error.code || 'EGIT';
      error.gitArgs = args;
      throw error;
    }
  }
  async run(args, { trimEnd = true, ...options } = {}) {
    const text = decodeGitOutput(await this.runBuffer(args, options));
    return trimEnd ? text.trimEnd() : text;
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
    const raw = await this.runBuffer(['diff', '--name-status', '-z', '--find-renames', '--find-copies', safeToken(range, 'diff range')]);
    return parseNameStatusZ(decodeGitOutput(raw));
  }
  showFile(ref, filePath) {
    const safeRef = safeToken(ref, 'Git ref');
    if (typeof filePath !== 'string' || !filePath || /[\0\r\n]/.test(filePath)) throw Object.assign(new Error('Git file path is invalid.'), { code: 'EGITTOKEN' });
    return this.run(['show', `${safeRef}:${filePath}`], { allowFailure: true, trimEnd: false });
  }
  trackingRef(remote, branch) { return `${safeToken(remote, 'Git remote name')}/${safeToken(branch, 'Git branch')}`; }
}

function decodeGitOutput(raw) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); }
  catch (cause) { throw Object.assign(new Error('Git output contains unsupported UTF-8 bytes.'), { code: 'EGITOUTPUT', cause }); }
}

module.exports = { GitCli, parseNameStatusZ, safeToken };
