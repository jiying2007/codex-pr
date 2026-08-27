'use strict';

const crypto = require('crypto');
const { escapeHtml } = require('./pr-domain');

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

function previewHtml(webview, state, ui) {
  const n = nonce();
  const draftKey = nonce();
  const csp = `default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}';`;
  const title = escapeHtml(state.title || '');
  const body = escapeHtml(state.body || '');
  const base = escapeHtml(state.baseRef || '');
  const head = escapeHtml(state.headBranch || '');
  const titleMaxLength = Math.min(160, Math.max(1, Number(state.titleMaxLength) || 160));
  const maxBodyChars = Math.min(20000, Math.max(1, Number(state.maxBodyChars) || 20000));
  const dirty = state.localDirty
    ? `<div class="notice">${escapeHtml(ui('本地未提交/暂存改动未包含在 PR 分析中。', 'Local uncommitted/staged changes are excluded from this PR analysis.'))}</div>`
    : '';
  const stale = state.stale
    ? `<div class="error">${escapeHtml(ui('HEAD、当前分支或 Base 已变化。当前结果已过期，请重新生成后再复制或打开 GitHub。', 'HEAD, current branch, or base changed. This result is stale; regenerate before copying or opening GitHub.'))}</div>`
    : '';
  const reviewEvidence = state.reviewEvidence?.status === 'available'
    ? `<div class="notice">${escapeHtml(ui(
      'Codex Review Safe 凭据匹配 {0}/{1} 个提交；这不等于人工批准或测试通过。',
      'Codex Review Safe receipts match {0}/{1} commits; this is not human approval or proof that tests passed.',
      state.reviewEvidence.reviewedCommits,
      state.reviewEvidence.totalCommits
    ))}</div>`
    : `<div class="notice">${escapeHtml(ui(
      '没有可用的 Codex Review Safe 提交凭据；PR 生成不会因此被阻断。',
      'No Codex Review Safe commit evidence is available; PR generation remains unblocked.'
    ))}</div>`;
  const egressDisabled = state.stale ? 'disabled' : '';
  const openDisabled = state.canOpenGitHub && !state.stale ? '' : 'disabled';
  const openHint = state.stale
    ? ui('当前结果已过期。', 'The current result is stale.')
    : state.canOpenGitHub
      ? ui('打开 GitHub Compare 页面；标题和正文会先复制到剪贴板，由你最终确认提交。', 'Open the GitHub Compare page. Title/body are copied first so you remain in control of the final submission.')
      : ui('当前分支尚未推送到可识别的 GitHub remote，或 remote 不是 GitHub。', 'The current branch is not published to a recognized GitHub remote, or the remote is not GitHub.');

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codex PR Safe</title>
<style nonce="${n}">
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;max-width:1100px;margin:auto}
  .meta{color:var(--vscode-descriptionForeground);margin-bottom:14px}.notice,.error{padding:10px;border-left:3px solid var(--vscode-editorWarning-foreground);background:var(--vscode-textBlockQuote-background);margin:10px 0}.error{border-left-color:var(--vscode-errorForeground);color:var(--vscode-errorForeground)}
  label{display:block;font-weight:600;margin:14px 0 6px}input,textarea{width:100%;box-sizing:border-box;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);padding:8px;font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size)}
  textarea{min-height:430px;resize:vertical;line-height:1.45}.buttons{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.buttons button{border:0;padding:7px 12px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);cursor:pointer}.buttons button:hover{background:var(--vscode-button-hoverBackground)}.buttons button.secondary{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}.buttons button:disabled{opacity:.45;cursor:not-allowed}.hint,.limit{color:var(--vscode-descriptionForeground);font-size:.9em}.limit{margin-top:4px;text-align:right}
</style>
</head>
<body>
<h1>Codex PR Safe</h1>
<div class="meta">${escapeHtml(ui('比较范围', 'Compare'))}: <code>${base}...${head}</code></div>
${dirty}
${stale}
${reviewEvidence}
<label for="title">${escapeHtml(ui('PR 标题', 'PR Title'))}</label>
<input id="title" value="${title}">
<div class="limit" id="titleLimit"></div>
<label for="body">${escapeHtml(ui('PR 正文', 'PR Body'))}</label>
<textarea id="body" maxlength="${maxBodyChars}">${body}</textarea>
<div class="limit" id="bodyLimit"></div>
<div class="buttons">
  <button id="copyAll" ${egressDisabled}>${escapeHtml(ui('复制全部', 'Copy All'))}</button>
  <button id="copyTitle" class="secondary" ${egressDisabled}>${escapeHtml(ui('复制标题', 'Copy Title'))}</button>
  <button id="copyBody" class="secondary" ${egressDisabled}>${escapeHtml(ui('复制正文', 'Copy Body'))}</button>
  <button id="regenerate" class="secondary">${escapeHtml(ui('重新生成', 'Regenerate'))}</button>
  <button id="changeBase" class="secondary">${escapeHtml(ui('更换 Base', 'Change Base'))}</button>
  <button id="openGitHub" ${openDisabled}>${escapeHtml(ui('打开 GitHub PR', 'Open GitHub PR'))}</button>
</div>
<div class="hint">${escapeHtml(openHint)}</div>
<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const draftKey = ${JSON.stringify(draftKey)};
  const titleMaxLength = ${titleMaxLength};
  const maxBodyChars = ${maxBodyChars};
  const title = document.getElementById('title');
  const body = document.getElementById('body');
  const titleLimit = document.getElementById('titleLimit');
  const bodyLimit = document.getElementById('bodyLimit');
  const saved = vscode.getState();
  if (saved && saved.draftKey === draftKey) {
    if (typeof saved.title === 'string') title.value = saved.title;
    if (typeof saved.body === 'string') body.value = saved.body;
  }
  function unicodeLength(value){ return Array.from(value).length; }
  function updateLimits(){
    titleLimit.textContent = unicodeLength(title.value) + ' / ' + titleMaxLength;
    bodyLimit.textContent = body.value.length + ' / ' + maxBodyChars;
  }
  function saveDraft(){ vscode.setState({ draftKey, title: title.value, body: body.value }); updateLimits(); }
  function payload(type){ return { type, title: title.value, body: body.value }; }
  title.addEventListener('input', saveDraft);
  body.addEventListener('input', saveDraft);
  updateLimits();
  document.getElementById('copyAll').addEventListener('click',()=>vscode.postMessage(payload('copyAll')));
  document.getElementById('copyTitle').addEventListener('click',()=>vscode.postMessage(payload('copyTitle')));
  document.getElementById('copyBody').addEventListener('click',()=>vscode.postMessage(payload('copyBody')));
  document.getElementById('regenerate').addEventListener('click',()=>vscode.postMessage(payload('regenerate')));
  document.getElementById('changeBase').addEventListener('click',()=>vscode.postMessage(payload('changeBase')));
  document.getElementById('openGitHub').addEventListener('click',()=>vscode.postMessage(payload('openGitHub')));
</script>
</body>
</html>`;
}

module.exports = { previewHtml };
