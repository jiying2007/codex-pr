'use strict';

const vscode = require('vscode');
const { git, refOid } = require('./git');
const { clampNumber, validateExtraInstructions } = require('./pr-domain');
const { readPolicySectionAtHead } = require('./codex-safe-core/policy');

function getUserOnlySetting(config, key, fallback) {
  const inspected = config.inspect(key);
  if (!inspected) return fallback;
  if (inspected.globalLanguageValue !== undefined) return inspected.globalLanguageValue;
  if (inspected.globalValue !== undefined) return inspected.globalValue;
  return inspected.defaultValue !== undefined ? inspected.defaultValue : fallback;
}

function gitForCore(args, repoRoot, token, options = {}) {
  return git(repoRoot, args, options, token);
}

async function readProjectRulesAtHead(root, token) {
  const headOid = await refOid(root, 'HEAD', token);
  return readPolicySectionAtHead({
    git: gitForCore,
    repoRoot: root,
    headOid,
    section: 'pr',
    token
  });
}

async function effectiveOptions(root, token) {
  const config = vscode.workspace.getConfiguration('safeCodexPr');
  const policy = await readProjectRulesAtHead(root, token);
  const project = policy.rules;

  const codexPath = String(getUserOnlySetting(config, 'codexPath', 'codex') || 'codex').trim();
  const model = String(getUserOnlySetting(config, 'model', '') || '').trim();
  if (!codexPath || codexPath.length > 1024 || /[\r\n\0]/.test(codexPath)) throw new Error('safeCodexPr.codexPath is invalid.');
  if (model.length > 128 || /[\r\n\0]/.test(model)) throw new Error('safeCodexPr.model is invalid.');

  const language = project.language ?? config.get('language', 'zh-CN');
  if (!['zh-CN', 'en'].includes(language)) throw new Error('safeCodexPr.language must be zh-CN or en.');

  const baseBranch = String(project.baseBranch ?? config.get('baseBranch', '') ?? '').trim();
  if (baseBranch.length > 256 || /[\r\n\0]/.test(baseBranch)) throw new Error('safeCodexPr.baseBranch is invalid.');

  const userInstructions = validateExtraInstructions(config.get('extraInstructions', ''));
  const repositoryInstructions = validateExtraInstructions(project.extraInstructions);

  return Object.freeze({
    codexPath,
    model,
    language,
    baseBranch,
    maxDiffBytes: clampNumber(project.maxDiffBytes ?? config.get('maxDiffBytes', 524288), 524288, 4096, 2097152, 'maxDiffBytes'),
    maxCommitBytes: clampNumber(project.maxCommitBytes ?? config.get('maxCommitBytes', 65536), 65536, 4096, 524288, 'maxCommitBytes'),
    titleMaxLength: clampNumber(project.titleMaxLength ?? config.get('titleMaxLength', 100), 100, 40, 160, 'titleMaxLength'),
    maxBodyChars: clampNumber(project.maxBodyChars ?? config.get('maxBodyChars', 8000), 8000, 1000, 20000, 'maxBodyChars'),
    includePullRequestTemplate: typeof project.includePullRequestTemplate === 'boolean'
      ? project.includePullRequestTemplate
      : Boolean(config.get('includePullRequestTemplate', true)),
    userInstructions,
    repositoryInstructions,
    timeoutSeconds: clampNumber(project.timeoutSeconds ?? config.get('timeoutSeconds', 120), 120, 10, 300, 'timeoutSeconds'),
    policySource: policy.source,
    policyFingerprint: policy.fingerprint
  });
}

module.exports = Object.freeze({
  getUserOnlySetting,
  readProjectRulesAtHead,
  effectiveOptions
});
