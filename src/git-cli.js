'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

class GitCli {
  constructor(cwd) { this.cwd = cwd; }
  async run(args, { allowFailure = false } = {}) {
    try { const { stdout } = await execFileAsync('git', args, { cwd: this.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' } }); return stdout.trimEnd(); }
    catch (error) { if (allowFailure) return ''; error.code = error.code || 'EGIT'; error.gitArgs = args; throw error; }
  }
  revParse(ref) { return this.run(['rev-parse', '--verify', ref]); }
  currentBranch() { return this.run(['branch', '--show-current']); }
  statusPorcelain() { return this.run(['status', '--porcelain=v1', '--untracked-files=all']); }
  remoteUrl(remote) { return this.run(['remote', 'get-url', remote]); }
  mergeBase(a, b) { return this.run(['merge-base', a, b]); }
  upstream() { return this.run(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFailure: true }); }
  async commits(range) {
    const text = await this.run(['log', '--format=%H%x09%s', '--first-parent', range]);
    return text ? text.split('\n').map(line => { const [sha, ...rest] = line.split('\t'); return { sha, subject: rest.join('\t') }; }) : [];
  }
  async changedFiles(range) {
    const text = await this.run(['diff', '--name-status', '--find-renames', range]);
    if (!text) return [];
    return text.split('\n').map(line => {
      const parts = line.split('\t'); const raw = parts.shift(); const status = raw[0];
      return { status, path: status === 'R' || status === 'C' ? parts.at(-1) : parts[0], oldPath: status === 'R' || status === 'C' ? parts[0] : undefined };
    });
  }
  showFile(ref, path) { return this.run(['show', `${ref}:${path}`], { allowFailure: true }); }
  trackingRef(remote, branch) { return `${remote}/${branch}`; }
}
module.exports = { GitCli };
