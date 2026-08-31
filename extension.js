'use strict';
const vscode = require('vscode');
const { GitCli } = require('./src/git-cli');
const { parseRemote } = require('./src/remote');
const { createProvider } = require('./src/provider-factory');
const { prepareDelivery, createOrUpdateDelivery } = require('./src/workflow');
const { evaluateReadiness } = require('./src/readiness');
const { collectProvenance } = require('./src/provenance');
const { createChangeReceiptStore } = require('./src/change-receipt-store');
const { DeliveryTreeProvider } = require('./src/delivery-tree');

let receiptStore;
let deliveryTree;
function readConfig() {
  const c = vscode.workspace.getConfiguration('safeCodexChange');
  const get = (k, d) => c.get(k, d);
  return { provider: get('provider', 'auto'), targetBranch: get('targetBranch', 'main'), remote: get('remote', 'origin'), githubApiBaseUrl: get('githubApiBaseUrl', 'https://api.github.com'), githubTokenEnv: get('githubTokenEnv', 'GITHUB_TOKEN'), gitlabApiBaseUrl: get('gitlabApiBaseUrl', ''), gitlabTokenEnv: get('gitlabTokenEnv', 'GITLAB_TOKEN'), allowInsecureHttp: get('allowInsecureHttp', false), requestTimeoutSeconds: get('requestTimeoutSeconds', 30), requireCleanWorktree: get('requireCleanWorktree', true), requirePushedHead: get('requirePushedHead', true), requireFreshTarget: get('requireFreshTarget', true), createAsDraft: get('createAsDraft', true), requiredChecks: get('requiredChecks', []), requiredApprovals: get('requiredApprovals', 0), labels: get('labels', []), reviewers: get('reviewers', []), managedSections: get('managedSections', true), includeReceipt: get('includeReceipt', true), provenancePolicy: get('provenancePolicy', 'advisory'), blockOnReviewFindings: get('blockOnReviewFindings', true) };
}
function normalizePath(value) { const path = require('node:path'); return process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value); }
function rootFromArg(arg) { return arg?.rootUri?.fsPath || arg?.resourceUri?.fsPath || '';
}
async function chooseRoot(commandArgs = []) {
  const direct = rootFromArg(commandArgs[0]); if (direct) return direct;
  const roots = [];
  try {
    const gitExt = vscode.extensions.getExtension('vscode.git'); const gitExports = gitExt ? (gitExt.isActive ? gitExt.exports : await gitExt.activate()) : null; const api = gitExports?.getAPI?.(1);
    for (const repo of api?.repositories || []) { const root = repo.rootUri?.fsPath; if (root && !roots.some(x => normalizePath(x) === normalizePath(root))) roots.push(root); }
  } catch {}
  if (!roots.length) for (const folder of vscode.workspace.workspaceFolders || []) if (folder.uri.scheme === 'file') roots.push(folder.uri.fsPath);
  if (!roots.length) throw new Error('Open a trusted local Git workspace first.');
  if (roots.length === 1) return roots[0];
  const picked = await vscode.window.showQuickPick(roots.map(root => ({ label: require('node:path').basename(root), description: root, root })), { placeHolder: 'Select the repository to deliver' });
  if (!picked) throw Object.assign(new Error('Repository selection cancelled.'), { code: 'ECANCELLED' });
  return picked.root;
}
async function buildContext(commandArgs = []) {
  if (!vscode.workspace.isTrusted) throw new Error('Restricted Mode is not supported. Trust the workspace first.');
  const root = await chooseRoot(commandArgs); const config = readConfig(); const git = new GitCli(root); const remote = parseRemote(await git.remoteUrl(config.remote)); const provider = createProvider(remote, config); return { root, config, git, provider };
}
async function collectContextProvenance(ctx, preflight) {
  if (!preflight.mergeBase) return { complete: false, totalCommits: preflight.commits.length, reviewReceipts: 0, commitReceipts: 0, reviewStatus: 'unavailable', commitStatus: 'unavailable' };
  return collectProvenance(vscode, ctx.root, preflight.mergeBase, 'HEAD');
}
function renderPreflight(p, provenance) {
  const lines = [`# Codex Change Safe — Delivery Preflight`, '', `**State:** ${p.state}`, '', `- Provider repository: \`${p.remote.projectPath}\``, `- Source: \`${p.sourceBranch}@${p.headSha}\``, `- Target: \`${p.targetBranch}@${p.targetSha || 'unknown'}\``, `- Merge base: \`${p.mergeBase || 'unknown'}\``, `- Commits: ${p.commits.length}`, `- Changed files: ${p.changedFiles.length}`];
  if (provenance) lines.push(`- Review provenance: ${provenance.reviewReceipts || 0}/${provenance.totalCommits || p.commits.length} (${provenance.reviewStatus || 'unknown'})`, `- Commit provenance: ${provenance.commitReceipts || 0}/${provenance.totalCommits || p.commits.length} (${provenance.commitStatus || 'unknown'})`);
  lines.push('', '## Blockers', ...(p.blockers.length ? p.blockers.map(x => `- ❌ ${x.message}`) : ['- None']), '', '## Warnings', ...(p.warnings.length ? p.warnings.map(x => `- ⚠️ ${x.message}`) : ['- None'])); return lines.join('\n');
}
function renderReadiness(r) { const checks = r.checks.length ? r.checks : r.observedChecks; return [`# Codex Change Safe — Merge Readiness`, '', `**State:** ${r.state}`, '', `- URL: ${r.change.url}`, `- Head: \`${r.change.headSha}\``, `- Merge state: \`${r.change.mergeState}\``, `- Approvals: ${r.approvals.length}`, `- Required-check policy: ${r.requiredCheckSource}${r.requiredChecks.length ? ` (${r.requiredChecks.join(', ')})` : ''}`, '', '## Blockers', ...(r.blockers.length ? r.blockers.map(x => `- ❌ ${x.message}`) : ['- None']), '', '## Waiting', ...(r.pending.length ? r.pending.map(x => `- ⏳ ${x.message}`) : ['- None']), '', '## Checks', ...(checks.length ? checks.map(x => `- ${x.state === 'success' ? '✅' : x.state === 'pending' ? '⏳' : '❌'} ${x.name}${r.checks.length ? '' : ' (observed)'}`) : ['- No checks reported'])].join('\n'); }
async function showMarkdown(text, title) { const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: text }); await vscode.window.showTextDocument(doc, { preview: true }); vscode.window.setStatusBarMessage(title, 4000); }
async function resolveChange(ctx) { const branch = await ctx.git.currentBranch(); const raw = await ctx.provider.findOpenChangeRequest(branch, ctx.config.targetBranch); if (!raw) throw new Error('No open PR/MR found for the current branch.'); const change = ctx.provider.normalize(raw); const localHead = await ctx.git.revParse('HEAD'); if (change.headSha && change.headSha !== localHead) throw new Error('Open PR/MR head does not match local HEAD; push/fetch and re-run Delivery Preflight.'); return change; }
function confirm(label, detail) { return vscode.window.showWarningMessage(detail, { modal: true }, label).then(x => x === label); }
async function run(name, fn) { try { await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Codex Change Safe: ${name}`, cancellable: false }, fn); } catch (error) { if (error?.code !== 'ECANCELLED') vscode.window.showErrorMessage(`Codex Change Safe: ${error.message}`); } }
async function preparedWithProvenance(ctx, existingBody = '') { const first = await prepareDelivery({ ...ctx, existingBody }); const provenance = await collectContextProvenance(ctx, first.preflight); return prepareDelivery({ ...ctx, existingBody, provenance, preflight: first.preflight }); }
async function currentReadiness(ctx, change) { return evaluateReadiness({ provider: ctx.provider, change, requiredChecks: ctx.config.requiredChecks, requiredApprovals: ctx.config.requiredApprovals }); }
function activate(contextApi) {
  receiptStore = createChangeReceiptStore(contextApi.globalState);
  deliveryTree = new DeliveryTreeProvider(vscode);
  contextApi.subscriptions.push(deliveryTree, vscode.window.registerTreeDataProvider('safeCodexChange.delivery', deliveryTree));
  const reg = (id, fn) => contextApi.subscriptions.push(vscode.commands.registerCommand(id, (...args) => run(id.split('.').at(-1), () => fn(...args))));
  reg('safeCodexChange.preflight', async (...args) => { const ctx = await buildContext(args); const prepared = await preparedWithProvenance(ctx); deliveryTree.update({ provider: `${ctx.provider.kind} · ${prepared.preflight.remote.host}`, branch: `${prepared.preflight.sourceBranch} → ${prepared.preflight.targetBranch}`, preflight: prepared.preflight.state }); await showMarkdown(renderPreflight(prepared.preflight, prepared.receipt.provenance), prepared.preflight.state); });
  reg('safeCodexChange.createOrUpdate', async (...args) => {
    const ctx = await buildContext(args); const preview = await preparedWithProvenance(ctx); if (preview.preflight.state === 'BLOCKED') { await showMarkdown(renderPreflight(preview.preflight, preview.receipt.provenance), 'BLOCKED'); return; }
    const existing = await ctx.provider.findOpenChangeRequest(preview.preflight.sourceBranch, preview.preflight.targetBranch); const verb = existing ? 'Update' : 'Create'; if (!await confirm(`${verb} ${ctx.provider.kind === 'github' ? 'PR' : 'MR'}`, `${verb} remote ${ctx.provider.kind === 'github' ? 'Pull Request' : 'Merge Request'} for ${preview.preflight.sourceBranch} → ${preview.preflight.targetBranch}?`)) return;
    const provenance = preview.receipt.provenance; const result = await createOrUpdateDelivery({ ...ctx, provenance, expectedHeadSha: preview.preflight.headSha, expectedMergeBase: preview.preflight.mergeBase }); if (!result.change) return;
    const stored = await receiptStore.persist(result.receipt, result.change, result.action); deliveryTree.update({ provider: `${ctx.provider.kind} · ${result.preflight.remote.host}`, branch: `${result.preflight.sourceBranch} → ${result.preflight.targetBranch}`, preflight: result.preflight.state, change: result.change }); const suffix = result.remoteWarnings?.length ? ` · Warning: ${result.remoteWarnings.map(x => x.message).join(' ')}` : ''; vscode.window.showInformationMessage(`${result.action === 'created' ? 'Created' : 'Updated'} ${result.change.url} · Snapshot ${stored.fingerprint.slice(0, 12)} · Delivery ${stored.deliveryFingerprint.slice(0, 12)}${suffix}`);
  });
  reg('safeCodexChange.refresh', async (...args) => { const ctx = await buildContext(args); const change = await resolveChange(ctx); const r = await currentReadiness(ctx, change); deliveryTree.update({ provider: ctx.provider.kind, branch: `${change.sourceBranch} → ${change.targetBranch}`, change: r.change, readiness: r.state }); await showMarkdown(renderReadiness(r), r.state); });
  reg('safeCodexChange.requestReviewers', async (...args) => { const ctx = await buildContext(args); const change = await resolveChange(ctx); const prepared = await preparedWithProvenance(ctx); if (!prepared.reviewers.length) return vscode.window.showInformationMessage('No reviewers suggested by CODEOWNERS or configuration.'); if (!await confirm('Request reviewers', `Request: ${prepared.reviewers.join(', ')}?`)) return; const fresh = await resolveChange(ctx); if (fresh.number !== change.number) throw Object.assign(new Error('PR/MR changed after confirmation; retry the operation.'), { code: 'ESTALE' }); await ctx.provider.requestReviewers(fresh.number, prepared.reviewers); vscode.window.showInformationMessage('Reviewer request updated.'); });
  reg('safeCodexChange.markReady', async (...args) => { const ctx = await buildContext(args); const change = await resolveChange(ctx); const prepared = await preparedWithProvenance(ctx); if (prepared.preflight.state === 'BLOCKED') return showMarkdown(renderPreflight(prepared.preflight, prepared.receipt.provenance), 'BLOCKED'); if (!await confirm('Mark ready', `Mark ${change.url} ready for review?`)) return; const freshPrepared = await preparedWithProvenance(ctx); if (freshPrepared.preflight.state === 'BLOCKED') return showMarkdown(renderPreflight(freshPrepared.preflight, freshPrepared.receipt.provenance), 'BLOCKED'); const fresh = await resolveChange(ctx); if (fresh.number !== change.number) throw Object.assign(new Error('PR/MR changed after confirmation; retry the operation.'), { code: 'ESTALE' }); await ctx.provider.markReady(fresh.raw); vscode.window.showInformationMessage('Change request marked ready.'); });
  reg('safeCodexChange.enableAutoMerge', async (...args) => { const ctx = await buildContext(args); const change = await resolveChange(ctx); const readiness = await currentReadiness(ctx, change); if (readiness.state === 'BLOCKED') { await showMarkdown(renderReadiness(readiness), readiness.state); return; } if (!await confirm('Enable auto-merge', `Enable native ${ctx.provider.kind} auto-merge with expected head ${readiness.change.headSha}?`)) return; const fresh = await resolveChange(ctx); const freshReadiness = await currentReadiness(ctx, fresh); if (freshReadiness.state === 'BLOCKED') return showMarkdown(renderReadiness(freshReadiness), freshReadiness.state); await ctx.provider.enableAutoMerge(freshReadiness.change.raw); vscode.window.showInformationMessage('Native auto-merge enabled.'); });
  reg('safeCodexChange.enqueueMergeQueue', async (...args) => { const ctx = await buildContext(args); if (ctx.provider.kind !== 'github') throw new Error('Merge Queue enqueue is GitHub-only; GitLab uses native auto-merge.'); const change = await resolveChange(ctx); const readiness = await currentReadiness(ctx, change); if (readiness.state !== 'READY_TO_MERGE') { await showMarkdown(renderReadiness(readiness), readiness.state); return; } if (!await confirm('Enqueue', `Add ${change.url} to the GitHub merge queue?`)) return; const fresh = await resolveChange(ctx); const freshReadiness = await currentReadiness(ctx, fresh); if (freshReadiness.state !== 'READY_TO_MERGE') return showMarkdown(renderReadiness(freshReadiness), freshReadiness.state); await ctx.provider.enqueueMergeQueue(freshReadiness.change.raw); vscode.window.showInformationMessage('Pull request enqueued.'); });
  reg('safeCodexChange.open', async (...args) => { const ctx = await buildContext(args); const change = await resolveChange(ctx); await vscode.env.openExternal(vscode.Uri.parse(change.url)); });
  return Object.freeze({ contractVersion: 1, getChangeReceipts: (provider, repository) => receiptStore.list(provider, repository) });
}
function deactivate() {}
module.exports = { activate, deactivate, readConfig, chooseRoot, renderPreflight, renderReadiness };
