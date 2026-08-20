'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  PROJECT_RULES_FILE,
  clampNumber,
  validateExtraInstructions,
  validateProjectRulesObject,
  normalizeRef,
  formatPullRequest,
  snapshotEqual,
  buildGitHubCompareUrl,
  repoLabel
} = require('./src/core');
const {
  resolveGitRoot,
  detectBase,
  repositorySnapshot,
  collectPrContext,
  resolveGitHubOpenContext
} = require('./src/git');
const { resolveCodexExecutable, runCodex } = require('./src/codex');
const { previewHtml } = require('./src/preview');

let outputChannel;
let extensionMode = vscode.ExtensionMode?.Production ?? 1;
let previewPanel;
let previewMessageDisposable;
const lastByRepo = new Map();
const activeGenerations = new Map();
let nextGenerationId = 1;

function isChineseUi() { return /^zh(?:-|$)/i.test(String(vscode.env?.language || '')); }
function ui(zh, en) { return isChineseUi() ? zh : en; }
function log(message) { outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`); }

function assertTrustedWorkspace() {
  if (!vscode.workspace.isTrusted) throw new Error(ui('当前工作区处于 Restricted Mode。请先信任工作区。', 'The workspace is in Restricted Mode. Trust the workspace first.'));
}

function getUserOnlySetting(config, key, fallback) {
  const inspected = config.inspect(key);
  if (!inspected) return fallback;
  if (inspected.globalLanguageValue !== undefined) return inspected.globalLanguageValue;
  if (inspected.globalValue !== undefined) return inspected.globalValue;
  return inspected.defaultValue !== undefined ? inspected.defaultValue : fallback;
}

function readProjectRules(root) {
  const file = path.join(root, PROJECT_RULES_FILE);
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return {};
    if (stat.size > 32 * 1024) throw new Error(`${PROJECT_RULES_FILE} exceeds 32 KiB.`);
    return validateProjectRulesObject(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new Error(ui(`无法读取 ${PROJECT_RULES_FILE}：${error.message}`, `Failed to read ${PROJECT_RULES_FILE}: ${error.message}`));
  }
}

function effectiveOptions(root) {
  const config = vscode.workspace.getConfiguration('safeCodexPr');
  const project = readProjectRules(root);
  const codexPath = String(getUserOnlySetting(config, 'codexPath', 'codex') || 'codex').trim() || 'codex';
  const model = String(getUserOnlySetting(config, 'model', '') || '').trim();
  const language = project.language ?? config.get('language', 'zh-CN');
  if (!['zh-CN', 'en'].includes(language)) throw new Error('safeCodexPr.language must be zh-CN or en.');
  const baseBranch = String(project.baseBranch ?? config.get('baseBranch', '') ?? '').trim();
  const extraInstructions = validateExtraInstructions(project.extraInstructions ?? config.get('extraInstructions', ''));
  return {
    codexPath,
    model,
    language,
    baseBranch,
    maxDiffBytes: clampNumber(project.maxDiffBytes ?? config.get('maxDiffBytes', 524288), 524288, 4096, 2097152, 'maxDiffBytes'),
    maxCommitBytes: clampNumber(project.maxCommitBytes ?? config.get('maxCommitBytes', 65536), 65536, 4096, 524288, 'maxCommitBytes'),
    titleMaxLength: clampNumber(project.titleMaxLength ?? config.get('titleMaxLength', 100), 100, 40, 160, 'titleMaxLength'),
    maxBodyChars: clampNumber(project.maxBodyChars ?? config.get('maxBodyChars', 8000), 8000, 1000, 20000, 'maxBodyChars'),
    includePullRequestTemplate: typeof project.includePullRequestTemplate === 'boolean' ? project.includePullRequestTemplate : Boolean(config.get('includePullRequestTemplate', true)),
    extraInstructions,
    timeoutSeconds: clampNumber(project.timeoutSeconds ?? config.get('timeoutSeconds', 120), 120, 10, 300, 'timeoutSeconds')
  };
}

function normalizeFsPath(value) {
  let resolved = path.resolve(value);
  try {
    resolved = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch {}
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
    .map(r => ({ label: r.name, description: r.oid.slice(0, 10), ref: r.name }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: ui('选择 PR Base（仅使用本地已有 refs，不会自动 fetch）', 'Select PR base (uses local refs only; no automatic fetch)') });
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

async function buildPreviewState(root, baseRef, context, structured, formatted, codexVersion, token) {
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
    compareUrl,
    canOpenGitHub: Boolean(compareUrl && gh.published),
    codexVersion
  };
}

function validateEditedResult(title, body) {
  const t = String(title || '').trim().replace(/\r?\n/g, ' ');
  const b = String(body || '').trim();
  if (!t || t.length > 160) throw new Error(ui('PR 标题为空或超过 160 字符。', 'PR title is empty or exceeds 160 characters.'));
  if (b.length > 20000) throw new Error(ui('PR 正文超过 20000 字符。', 'PR body exceeds 20000 characters.'));
  if (/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(`${t}\n${b}`)) throw new Error(ui('PR 内容包含非法控制字符。', 'PR content contains invalid control characters.'));
  return { title: t, body: b };
}

function textForClipboard(title, body) { return `${title}\n\n${body}`.trim(); }

async function copyValue(kind, edited) {
  const value = kind === 'title' ? edited.title : kind === 'body' ? edited.body : textForClipboard(edited.title, edited.body);
  await vscode.env.clipboard.writeText(value);
  vscode.window.setStatusBarMessage(ui('Codex PR Safe：已复制', 'Codex PR Safe: copied'), 2500);
}

async function renderPreview(state) {
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel('safeCodexPr.preview', 'Codex PR Safe', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
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
      const edited = validateEditedResult(message.title, message.body);
      const latest = lastByRepo.get(normalizeFsPath(state.root));
      if (!latest) throw new Error(ui('当前 PR 结果已失效，请重新生成。', 'The current PR result is stale. Generate it again.'));
      latest.title = edited.title; latest.body = edited.body;
      if (message.type === 'copyAll') return copyValue('all', edited);
      if (message.type === 'copyTitle') return copyValue('title', edited);
      if (message.type === 'copyBody') return copyValue('body', edited);
      if (message.type === 'regenerate') return generate({ regenerate: true, rootOverride: state.root, baseOverride: state.baseRef });
      if (message.type === 'changeBase') return generate({ regenerate: false, rootOverride: state.root, forceBasePick: true });
      if (message.type === 'openGitHub') {
        const currentSnapshot = await repositorySnapshot(state.root, state.baseRef);
        if (!snapshotEqual(currentSnapshot, latest.snapshot)) throw new Error(ui('HEAD 或 Base 已变化，请重新生成 PR。', 'HEAD or base changed. Regenerate the PR first.'));
        const gh = await resolveGitHubOpenContext(state.root, state.baseRef, state.headBranch);
        const compareUrl = buildGitHubCompareUrl({ baseRemote: gh.baseRemote, baseBranch: gh.baseBranch, headRemote: gh.headRemote, headBranch: gh.headBranch });
        if (!compareUrl || !gh.published) throw new Error(ui('当前分支尚未推送到可识别的 GitHub remote。', 'The current branch is not published to a recognized GitHub remote.'));
        latest.compareUrl = compareUrl; latest.canOpenGitHub = true;
        await copyValue('all', edited);
        await vscode.env.openExternal(vscode.Uri.parse(compareUrl));
        vscode.window.showInformationMessage(ui('PR 标题和正文已复制；请在 GitHub 页面最终确认并提交。', 'PR title/body copied. Review and submit them on GitHub.'));
      }
    } catch (error) { showError(error); }
  });
}

async function generate({ regenerate = false, commandArgs = [], rootOverride = '', baseOverride = '', forceBasePick = false } = {}) {
  assertTrustedWorkspace();
  const root = rootOverride || await chooseRepository(commandArgs);
  if (!root) return;
  const options = effectiveOptions(root);
  const prior = lastByRepo.get(normalizeFsPath(root));
  const baseRef = baseOverride || (regenerate && prior?.baseRef) || await selectBase(root, options, undefined, forceBasePick);
  if (!baseRef) return;
  const { key, state } = beginGeneration(root);
  log(`${regenerate ? 'regenerate' : 'generate'} started for ${repoLabel(root)}: ${baseRef}...HEAD`);

  try {
    const generated = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: regenerate ? ui('Codex 正在重新生成 PR…', 'Codex is regenerating the PR…') : ui('Codex 正在生成 PR…', 'Codex is generating the PR…'), cancellable: true }, async (_progress, uiToken) => {
      const linked = linkCancellation(uiToken, state.cancelSource);
      try {
        const token = state.cancelSource.token;
        const before = await repositorySnapshot(root, baseRef, token);
        const context = await collectPrContext(root, baseRef, options, token);
        const afterCollection = await repositorySnapshot(root, baseRef, token);
        if (!snapshotEqual(before, afterCollection)) throw Object.assign(new Error(ui('收集 PR 输入期间 HEAD 或 Base 已变化，请重试。', 'HEAD or base changed while collecting PR input. Try again.')), { code: 'ESTALE' });
        const previousStructured = regenerate ? prior?.structured : undefined;
        const codex = await runCodex(context, options, previousStructured, token);
        const beforeUse = await repositorySnapshot(root, baseRef, token);
        if (!snapshotEqual(before, beforeUse)) throw Object.assign(new Error(ui('Codex 生成期间 HEAD 或 Base 已变化，结果已丢弃。', 'HEAD or base changed while Codex was generating. The result was discarded.')), { code: 'ESTALE' });
        const formatted = formatPullRequest(codex.result, options, { baseRef, headBranch: context.headBranch });
        const preview = await buildPreviewState(root, baseRef, context, codex.result, formatted, codex.codexVersion, token);
        return { preview, snapshot: before };
      } finally { linked.dispose(); }
    });
    if (!isCurrentGeneration(key, state.id)) return;
    const stored = { ...generated.preview, snapshot: generated.snapshot };
    lastByRepo.set(key, stored);
    await renderPreview(stored);
    log(`generation completed: risk=${stored.structured.riskLevel}, breaking=${stored.structured.breakingChange}`);
  } catch (error) {
    if (error?.code !== 'ECANCELLED') showError(error);
    if (extensionMode === vscode.ExtensionMode.Test) throw error;
  } finally { finishGeneration(key, state.id); }
}

async function commandWithLast(kind, commandArgs = []) {
  assertTrustedWorkspace();
  const root = await chooseRepository(commandArgs);
  if (!root) return;
  const state = lastByRepo.get(normalizeFsPath(root));
  if (!state) throw new Error(ui('该仓库还没有生成过 PR，请先运行 Generate PR。', 'No PR has been generated for this repository yet. Run Generate PR first.'));
  const current = await repositorySnapshot(root, state.baseRef);
  if (!snapshotEqual(current, state.snapshot)) throw new Error(ui('HEAD 或 Base 已变化，请重新生成 PR。', 'HEAD or base changed. Regenerate the PR.'));
  if (kind === 'show') return renderPreview(state);
  if (kind === 'title') return copyValue('title', state);
  if (kind === 'body') return copyValue('body', state);
  if (kind === 'all') return copyValue('all', state);
  if (kind === 'open') {
    const gh = await resolveGitHubOpenContext(root, state.baseRef, state.headBranch);
    const compareUrl = buildGitHubCompareUrl({ baseRemote: gh.baseRemote, baseBranch: gh.baseBranch, headRemote: gh.headRemote, headBranch: gh.headBranch });
    if (!compareUrl || !gh.published) throw new Error(ui('当前分支尚未推送到可识别的 GitHub remote。', 'The current branch is not published to a recognized GitHub remote.'));
    state.compareUrl = compareUrl; state.canOpenGitHub = true;
    await copyValue('all', state);
    await vscode.env.openExternal(vscode.Uri.parse(compareUrl));
  }
}

async function checkEnvironment(commandArgs = []) {
  assertTrustedWorkspace();
  const root = await chooseRepository(commandArgs);
  if (!root) return;
  const options = effectiveOptions(root);
  const detected = await detectBase(root, options.baseBranch);
  const resolved = await resolveCodexExecutable(options.codexPath);
  vscode.window.showInformationMessage(ui(`Codex PR Safe 环境正常：${resolved.version}；当前分支 ${detected.branch}；Base ${detected.candidate || '未检测到'}`, `Codex PR Safe environment OK: ${resolved.version}; branch ${detected.branch}; base ${detected.candidate || 'not detected'}`));
}

function showError(error) {
  const detail = error?.stderr || error?.message || String(error);
  log(`error: ${detail}`);
  vscode.window.showErrorMessage(ui(`Codex PR Safe 失败：${detail}`, `Codex PR Safe failed: ${detail}`), ui('查看输出', 'Show Output')).then(choice => { if (choice) outputChannel?.show(true); });
}

function activate(context) {
  extensionMode = context.extensionMode;
  outputChannel = vscode.window.createOutputChannel('Codex PR Safe');
  context.subscriptions.push(outputChannel);
  const reg = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, (...args) => Promise.resolve(fn(args)).catch(error => {
    if (extensionMode === vscode.ExtensionMode.Test) throw error;
    showError(error);
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
  if (extensionMode === vscode.ExtensionMode.Test) {
    context.subscriptions.push(vscode.commands.registerCommand('safeCodexPr._testState', root => lastByRepo.get(normalizeFsPath(root)) || null));
  }
  log('activated');
}

function deactivate() {
  for (const state of activeGenerations.values()) { state.cancelSource.cancel(); state.cancelSource.dispose(); }
  activeGenerations.clear();
  previewMessageDisposable?.dispose();
  previewPanel?.dispose();
}

module.exports = { activate, deactivate, effectiveOptions, validateEditedResult, textForClipboard };
