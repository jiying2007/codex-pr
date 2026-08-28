'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  normalizeRef,
  formatPullRequest,
  normalizeReviewRangeEvidence,
  normalizeCommitRangeEvidence,
  snapshotEqual,
  buildGitHubCompareUrl,
  repoLabel
} = require('./src/pr-domain');
const {
  resolveGitRoot,
  currentBranch,
  detectBase,
  repositorySnapshot,
  collectPrContext,
  resolveGitHubOpenContext
} = require('./src/git');
const { effectiveOptions } = require('./src/policy');
const { resolveCodexExecutable, probeCodexCapabilities, probeCodexRuntime, runCodex } = require('./src/codex');
const { previewHtml } = require('./src/preview');
const { collectPrImpactEvidence } = require('./src/quality');

let outputChannel;
let extensionMode = vscode.ExtensionMode?.Production ?? 1;
let previewPanel;
let previewMessageDisposable;
const lastByRepo = new Map();
const activeGenerations = new Map();
let nextGenerationId = 1;
const REVIEW_EXTENSION_ID = 'jiying2007.codex-review-safe';
const COMMIT_EXTENSION_ID = 'jiying2007.codex-commit-safe';

function formatLocalized(message, args = []) {
  return String(message).replace(/\{(\d+)\}/g, (_match, index) =>
    args[Number(index)] === undefined ? '{' + index + '}' : String(args[Number(index)])
  );
}
function isChineseUi() { return /^zh(?:-|$)/i.test(String(vscode.env?.language || '')); }
function t(message, ...args) {
  if (vscode.l10n?.t) return vscode.l10n.t(message, ...args);
  return formatLocalized(message, args);
}
function ui(zh, en, ...args) {
  const english = formatLocalized(en, args);
  const localized = t(en, ...args);
  if (localized !== english || !isChineseUi()) return localized;
  return formatLocalized(zh, args);
}
function log(message) { outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`); }

function assertTrustedWorkspace() {
  if (!vscode.workspace.isTrusted) throw new Error(ui('当前工作区处于 Restricted Mode。请先信任工作区。', 'The workspace is in Restricted Mode. Trust the workspace first.'));
}

async function getReviewEvidence(root, baseRef, headOid, token) {
  try {
    const extension = vscode.extensions.getExtension(REVIEW_EXTENSION_ID);
    if (!extension) return { status: 'unavailable', totalCommits: 0, reviewedCommits: 0, blockedCommits: 0 };
    const api = extension.isActive ? extension.exports : await extension.activate();
    if (typeof api?.getReviewEvidenceForRange !== 'function') return { status: 'unsupported', totalCommits: 0, reviewedCommits: 0, blockedCommits: 0 };
    const result = await api.getReviewEvidenceForRange(root, baseRef, headOid, token);
    return normalizeReviewRangeEvidence(result);
  } catch (error) {
    if (error?.code === 'ECANCELLED') throw error;
    return { status: 'error', totalCommits: 0, reviewedCommits: 0, blockedCommits: 0 };
  }
}

async function getCommitEvidence(root, baseRef, headOid, token) {
  try {
    const extension = vscode.extensions.getExtension(COMMIT_EXTENSION_ID);
    if (!extension) return { status: 'unavailable', totalCommits: 0, generatedCommits: 0, reviewedGeneratedCommits: 0 };
    const api = extension.isActive ? extension.exports : await extension.activate();
    if (typeof api?.getCommitEvidenceForRange !== 'function') return { status: 'unsupported', totalCommits: 0, generatedCommits: 0, reviewedGeneratedCommits: 0 };
    const result = await api.getCommitEvidenceForRange(root, baseRef, headOid, token);
    return normalizeCommitRangeEvidence(result);
  } catch (error) {
    if (error?.code === 'ECANCELLED') throw error;
    return { status: 'error', totalCommits: 0, generatedCommits: 0, reviewedGeneratedCommits: 0 };
  }
}

function normalizeFsPath(value) {
  let resolved = path.resolve(value);
  try { resolved = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved); } catch {}
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function rootFromCommandArg(arg) {
  const candidates = [arg?.rootUri?.fsPath, arg?.rootUri?.path, arg?.resourceUri?.fsPath];
  return candidates.find(x => typeof x === 'string' && x) || '';
}

async function chooseRepository(commandArgs = [], token) {
  const argRoot = rootFromCommandArg(commandArgs[0]);
  if (argRoot) {
    const root = await resolveGitRoot(argRoot, token);
    if (root) return root;
  }
  const folders = vscode.workspace.workspaceFolders || [];
  const roots = [];
  for (const folder of folders) {
    const root = await resolveGitRoot(folder.uri.fsPath, token);
    if (root && !roots.some(x => normalizeFsPath(x) === normalizeFsPath(root))) roots.push(root);
  }
  if (!roots.length) throw new Error(ui('当前工作区没有可用的 Git 仓库。', 'No usable Git repository exists in the workspace.'));
  if (roots.length === 1) return roots[0];
  const picked = await vscode.window.showQuickPick(roots.map(root => ({ label: repoLabel(root), description: root, root })), {
    placeHolder: ui('选择要生成 PR 的仓库', 'Select the repository for the PR')
  });
  return picked?.root || '';
}

async function selectBase(root, options, token, forcePick = false) {
  const detected = await detectBase(root, options.baseBranch, token);
  if (!detected.refs.length) throw new Error(ui('没有找到可作为 Base 的本地/远端 Git ref。请先 fetch。', 'No local/remote Git ref can be used as a base. Fetch the repository first.'));
  const configuredExists = options.baseBranch && detected.refs.some(r => normalizeRef(r.name) === normalizeRef(options.baseBranch));
  if (!forcePick && configuredExists) return normalizeRef(options.baseBranch);
  if (!forcePick && detected.candidate) return detected.candidate;
  const items = detected.refs
    .filter(r => normalizeRef(r.name) !== normalizeRef(detected.branch))
    .sort((a, b) => {
      const ca = normalizeRef(a.name) === normalizeRef(detected.candidate) ? -1 : 0;
      const cb = normalizeRef(b.name) === normalizeRef(detected.candidate) ? -1 : 0;
      return ca - cb || a.name.localeCompare(b.name);
    })
    .map(r => ({ label: r.name, description: `${r.kind || 'ref'} · ${r.oid.slice(0, 10)}`, ref: r.name }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: detected.forkTopology
      ? ui('选择 PR Base（检测到 fork；建议选择 upstream 的目标分支）', 'Select PR base (fork detected; prefer the upstream target branch)')
      : ui('选择 PR Base（没有高置信度默认值；不会自动 fetch）', 'Select PR base (no high-confidence default; no automatic fetch)')
  });
  return picked?.ref || '';
}

function beginGeneration(root) {
  const key = normalizeFsPath(root);
  const previous = activeGenerations.get(key);
  if (previous) { previous.cancelSource.cancel(); previous.cancelSource.dispose(); }
  const state = { id: nextGenerationId++, cancelSource: new vscode.CancellationTokenSource() };
  activeGenerations.set(key, state);
  return { key, state };
}
function isCurrentGeneration(key, id) { return activeGenerations.get(key)?.id === id; }
function finishGeneration(key, id) { const cur = activeGenerations.get(key); if (cur?.id === id) { cur.cancelSource.dispose(); activeGenerations.delete(key); } }
function linkCancellation(externalToken, internalSource) {
  if (externalToken.isCancellationRequested) { internalSource.cancel(); return { dispose() {} }; }
  return externalToken.onCancellationRequested(() => internalSource.cancel());
}

async function repositoryIdentity(root, baseRef, token) {
  const [snapshot, headBranch] = await Promise.all([repositorySnapshot(root, baseRef, token), currentBranch(root, token)]);
  return { ...snapshot, headBranch };
}

function repositoryIdentityEqual(a, b) {
  return Boolean(a && b && a.headBranch === b.headBranch && snapshotEqual(a, b));
}

async function buildPreviewState(root, baseRef, context, structured, formatted, codexVersion, provenance, reviewEvidence, commitEvidence, options, token) {
  const gh = await resolveGitHubOpenContext(root, baseRef, context.headBranch, token);
  const compareUrl = buildGitHubCompareUrl({ baseRemote: gh.baseRemote, baseBranch: gh.baseBranch, headRemote: gh.headRemote, headBranch: gh.headBranch });
  return {
    root,
    baseRef,
    headBranch: context.headBranch,
    headOid: context.headOid,
    baseOid: context.baseOid,
    localDirty: context.localDirty,
    structured,
    title: formatted.title,
    body: formatted.body,
    titleMaxLength: options.titleMaxLength,
    maxBodyChars: options.maxBodyChars,
    compareUrl,
    canOpenGitHub: Boolean(compareUrl && gh.published),
    codexVersion,
    provenance,
    reviewEvidence,
    commitEvidence,
    stale: false
  };
}

function validateEditedResult(title, body, limits = {}) {
  const t = String(title || '').trim().replace(/\r?\n/g, ' ');
  const b = String(body || '').trim();
  const titleMaxLength = Math.min(160, Math.max(1, Number(limits.titleMaxLength) || 160));
  const maxBodyChars = Math.min(20000, Math.max(1, Number(limits.maxBodyChars) || 20000));
  if (!t || Array.from(t).length > titleMaxLength) throw new Error(ui('PR 标题为空或超过 {0} 个字符。', 'PR title is empty or exceeds {0} characters.', titleMaxLength));
  if (b.length > maxBodyChars) throw new Error(ui('PR 正文超过 {0} 字符。', 'PR body exceeds {0} characters.', maxBodyChars));
  if (/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(`${t}\n${b}`)) throw new Error(ui('PR 内容包含非法控制字符。', 'PR content contains invalid control characters.'));
  return { title: t, body: b };
}

function textForClipboard(title, body) { return `${title}\n\n${body}`.trim(); }

async function copyValue(kind, edited) {
  const value = kind === 'title' ? edited.title : kind === 'body' ? edited.body : textForClipboard(edited.title, edited.body);
  await vscode.env.clipboard.writeText(value);
  vscode.window.setStatusBarMessage(ui('Codex PR Safe：已复制', 'Codex PR Safe: copied'), 2500);
}

async function ensureFreshResult(state, token) {
  const current = await repositoryIdentity(state.root, state.baseRef, token);
  if (!repositoryIdentityEqual(current, state.snapshot)) {
    const error = new Error(ui('HEAD、当前分支或 Base 已变化，当前 PR 结果已过期，请重新生成。', 'HEAD, current branch, or base changed. The current PR result is stale; regenerate it first.'));
    error.code = 'ESTALE';
    throw error;
  }
  return current;
}

async function renderPreview(state) {
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel('safeCodexPr.preview', 'Codex PR Safe', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    previewPanel.onDidDispose(() => { previewMessageDisposable?.dispose(); previewMessageDisposable = undefined; previewPanel = undefined; });
  }
  previewPanel.title = `Codex PR Safe · ${repoLabel(state.root)}`;
  previewPanel.webview.html = previewHtml(previewPanel.webview, state, ui);
  previewPanel.reveal(vscode.ViewColumn.Beside, true);
  previewMessageDisposable?.dispose();
  previewMessageDisposable = previewPanel.webview.onDidReceiveMessage(async message => {
    try {
      const allowed = new Set(['copyAll', 'copyTitle', 'copyBody', 'regenerate', 'changeBase', 'openGitHub']);
      if (!message || !allowed.has(message.type)) return;
      const latest = lastByRepo.get(normalizeFsPath(state.root));
      if (!latest) throw new Error(ui('当前 PR 结果已失效，请重新生成。', 'The current PR result is stale. Generate it again.'));
      if (message.type === 'regenerate') return generate({ regenerate: true, rootOverride: state.root, baseOverride: state.baseRef });
      if (message.type === 'changeBase') return generate({ regenerate: false, rootOverride: state.root, forceBasePick: true });
      await ensureFreshResult(latest);
      const edited = validateEditedResult(message.title, message.body, latest);
      latest.title = edited.title;
      latest.body = edited.body;
      latest.stale = false;
      if (message.type === 'copyAll') return copyValue('all', edited);
      if (message.type === 'copyTitle') return copyValue('title', edited);
      if (message.type === 'copyBody') return copyValue('body', edited);
      if (message.type === 'openGitHub') {
        const gh = await resolveGitHubOpenContext(state.root, state.baseRef, state.headBranch);
        const compareUrl = buildGitHubCompareUrl({ baseRemote: gh.baseRemote, baseBranch: gh.baseBranch, headRemote: gh.headRemote, headBranch: gh.headBranch });
        if (!compareUrl || !gh.published) throw new Error(ui('当前分支尚未推送到可识别的 GitHub remote。', 'The current branch is not published to a recognized GitHub remote.'));
        await ensureFreshResult(latest);
        latest.compareUrl = compareUrl;
        latest.canOpenGitHub = true;
        await copyValue('all', edited);
        await vscode.env.openExternal(vscode.Uri.parse(compareUrl));
        vscode.window.showInformationMessage(ui('PR 标题和正文已复制；请在 GitHub 页面最终确认并提交。', 'PR title/body copied. Review and submit them on GitHub.'));
      }
    } catch (error) {
      if (error?.code === 'ESTALE') {
        const latest = lastByRepo.get(normalizeFsPath(state.root));
        if (latest) {
          latest.stale = true;
          if (previewPanel) previewPanel.webview.html = previewHtml(previewPanel.webview, latest, ui);
        }
      }
      showError(error);
      if (extensionMode === vscode.ExtensionMode.Test) throw error;
    }
  });
}

async function generate({ regenerate = false, commandArgs = [], rootOverride = '', baseOverride = '', forceBasePick = false } = {}) {
  assertTrustedWorkspace();
  const root = rootOverride || await chooseRepository(commandArgs);
  if (!root) return;
  const options = await effectiveOptions(root);
  const prior = lastByRepo.get(normalizeFsPath(root));
  const baseRef = baseOverride || (regenerate && prior?.baseRef) || await selectBase(root, options, undefined, forceBasePick);
  if (!baseRef) return;
  const { key, state } = beginGeneration(root);
  log(`${regenerate ? 'regenerate' : 'generate'} started for ${repoLabel(root)}: ${baseRef}...HEAD`);

  try {
    const generated = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: regenerate ? ui('Codex 正在重新生成 PR…', 'Codex is regenerating the PR…') : ui('Codex 正在生成 PR…', 'Codex is generating the PR…'),
      cancellable: true
    }, async (_progress, uiToken) => {
      const linked = linkCancellation(uiToken, state.cancelSource);
      try {
        const token = state.cancelSource.token;
        const before = await repositoryIdentity(root, baseRef, token);
        let context = await collectPrContext(root, baseRef, options, token);
        const impact = await collectPrImpactEvidence(root, context.diff, options.profileConfig, token);
        context = Object.freeze({ ...context, impact });
        const afterCollection = await repositoryIdentity(root, baseRef, token);
        if (!repositoryIdentityEqual(before, afterCollection)) throw Object.assign(new Error(ui('收集 PR 输入期间 HEAD、当前分支或 Base 已变化，请重试。', 'HEAD, current branch, or base changed while collecting PR input. Try again.')), { code: 'ESTALE' });
        const previousStructured = regenerate ? prior?.structured : undefined;
        const codex = await runCodex(context, options, previousStructured, token);
        const beforeUse = await repositoryIdentity(root, baseRef, token);
        if (!repositoryIdentityEqual(before, beforeUse)) throw Object.assign(new Error(ui('Codex 生成期间 HEAD、当前分支或 Base 已变化，结果已丢弃。', 'HEAD, current branch, or base changed while Codex was generating. The result was discarded.')), { code: 'ESTALE' });
        const [reviewEvidence, commitEvidence] = await Promise.all([
          getReviewEvidence(root, baseRef, context.headOid, token),
          getCommitEvidence(root, baseRef, context.headOid, token)
        ]);
        const formatted = formatPullRequest(codex.result, options, { baseRef, headBranch: context.headBranch, reviewEvidence, commitEvidence });
        const preview = await buildPreviewState(root, baseRef, context, codex.result, formatted, codex.codexVersion, codex.provenance, reviewEvidence, commitEvidence, options, token);
        const afterPreview = await repositoryIdentity(root, baseRef, token);
        if (!repositoryIdentityEqual(before, afterPreview)) throw Object.assign(new Error(ui('生成 PR 预览期间 HEAD、当前分支或 Base 已变化，结果已丢弃。', 'HEAD, current branch, or base changed while the PR preview was being prepared. The result was discarded.')), { code: 'ESTALE' });
        return { preview, snapshot: before };
      } finally { linked.dispose(); }
    });
    if (!isCurrentGeneration(key, state.id)) return;
    const stored = { ...generated.preview, snapshot: generated.snapshot };
    lastByRepo.set(key, stored);
    await renderPreview(stored);
    log(`generation completed: risk=${stored.structured.riskLevel}, breaking=${stored.structured.breakingChange}, provenance=${stored.commitEvidence.status}, promptContract=${stored.provenance?.promptContractVersion || "unknown"}`);
  } catch (error) {
    if (error?.code !== 'ECANCELLED') showError(error);
    if (extensionMode === vscode.ExtensionMode.Test) throw error;
  } finally {
    finishGeneration(key, state.id);
  }
}

async function commandWithLast(kind, commandArgs = []) {
  assertTrustedWorkspace();
  const root = await chooseRepository(commandArgs);
  if (!root) return;
  const state = lastByRepo.get(normalizeFsPath(root));
  if (!state) throw new Error(ui('该仓库还没有生成过 PR，请先运行 Generate PR。', 'No PR has been generated for this repository yet. Run Generate PR first.'));
  await ensureFreshResult(state);
  state.stale = false;
  if (kind === 'show') return renderPreview(state);
  const edited = validateEditedResult(state.title, state.body, state);
  if (kind === 'title') return copyValue('title', edited);
  if (kind === 'body') return copyValue('body', edited);
  if (kind === 'all') return copyValue('all', edited);
  if (kind === 'open') {
    const gh = await resolveGitHubOpenContext(root, state.baseRef, state.headBranch);
    const compareUrl = buildGitHubCompareUrl({ baseRemote: gh.baseRemote, baseBranch: gh.baseBranch, headRemote: gh.headRemote, headBranch: gh.headBranch });
    if (!compareUrl || !gh.published) throw new Error(ui('当前分支尚未推送到可识别的 GitHub remote。', 'The current branch is not published to a recognized GitHub remote.'));
    await ensureFreshResult(state);
    state.compareUrl = compareUrl;
    state.canOpenGitHub = true;
    await copyValue('all', edited);
    await vscode.env.openExternal(vscode.Uri.parse(compareUrl));
  }
}

async function checkEnvironment(commandArgs = []) {
  assertTrustedWorkspace();
  const root = await chooseRepository(commandArgs);
  if (!root) return;
  const options = await effectiveOptions(root);
  const detected = await detectBase(root, options.baseBranch);
  const runtime = await probeCodexRuntime({codexPath:options.codexPath,model:options.model,runtime:options.codexRuntime});
  const endpoint = runtime.provider.endpointHost || 'Codex default';
  vscode.window.showInformationMessage(ui(
    `Codex PR Safe 环境正常：${runtime.codexVersion || options.codexPath}；当前分支 ${detected.branch}；Base ${detected.candidate || '需手动选择'}；Provider ${runtime.provider.mode} (${endpoint})；真实结构化探测 ${runtime.durationMs} ms`,
    `Codex PR Safe environment OK: ${runtime.codexVersion || options.codexPath}; branch ${detected.branch}; base ${detected.candidate || 'manual selection required'}; provider ${runtime.provider.mode} (${endpoint}); live structured probe ${runtime.durationMs} ms`
  ));
}

function showError(error) {
  const provider = error?.provider;
  const meta = provider ? ` Provider: ${provider.mode}${provider.endpointHost ? ` @ ${provider.endpointHost}` : ''}.` : '';
  const timing = Number.isFinite(error?.elapsedMs) ? ` Elapsed: ${Math.round(error.elapsedMs/100)/10}s.` : '';
  const diagnostic = error?.diagnosticTail ? ` Diagnostic: ${String(error.diagnosticTail).slice(-1200)}` : '';
  const detail = `${String(error?.message || error?.stderr || error || 'Unknown error')}${meta}${timing}${diagnostic}`.slice(0, 4000);
  log(`error: ${error?.code || error?.name || 'ERROR'}`);
  vscode.window.showErrorMessage(ui(`Codex PR Safe 失败：${detail}`, `Codex PR Safe failed: ${detail}`), ui('查看输出', 'Show Output')).then(choice => { if (choice) outputChannel?.show(true); });
}

function activate(context) {
  extensionMode = context.extensionMode;
  outputChannel = vscode.window.createOutputChannel('Codex PR Safe');
  context.subscriptions.push(outputChannel);
  const reg = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, (...args) => Promise.resolve(fn(args)).catch(error => {
    showError(error);
    if (extensionMode === vscode.ExtensionMode.Test) throw error;
  })));
  reg('safeCodexPr.generate', args => generate({ commandArgs: args }));
  reg('safeCodexPr.regenerate', args => generate({ regenerate: true, commandArgs: args }));
  reg('safeCodexPr.selectBaseAndGenerate', args => generate({ commandArgs: args, forceBasePick: true }));
  reg('safeCodexPr.showLast', args => commandWithLast('show', args));
  reg('safeCodexPr.copyTitle', args => commandWithLast('title', args));
  reg('safeCodexPr.copyBody', args => commandWithLast('body', args));
  reg('safeCodexPr.copyAll', args => commandWithLast('all', args));
  reg('safeCodexPr.openPullRequest', args => commandWithLast('open', args));
  reg('safeCodexPr.checkEnvironment', args => checkEnvironment(args));
  if (extensionMode === vscode.ExtensionMode.Test) context.subscriptions.push(vscode.commands.registerCommand('safeCodexPr._testState', root => lastByRepo.get(normalizeFsPath(root)) || null));
  log('activated');
}

function deactivate() {
  for (const state of activeGenerations.values()) { state.cancelSource.cancel(); state.cancelSource.dispose(); }
  activeGenerations.clear();
  previewMessageDisposable?.dispose();
  previewPanel?.dispose();
}

module.exports = {
  activate,
  deactivate,
  effectiveOptions,
  validateEditedResult,
  textForClipboard,
  normalizeFsPath,
  ensureFreshResult,
  getReviewEvidence,
  getCommitEvidence,
  repositoryIdentityEqual
};
