'use strict';

const vscode = require('vscode');
const { git, refOid } = require('./git');
const { clampNumber, validateExtraInstructions } = require('./pr-domain');
const { readPolicySectionAtHead } = require('./codex-safe-core/policy');
const { resolveReviewProfile } = require('./codex-safe-core/quality-platform');
const { normalizeCodexRuntimeOptions } = require('./codex-safe-core/codex-runtime');

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

  const profile = resolveReviewProfile(String(getUserOnlySetting(config, 'profile', 'standard') || 'standard'));
  const providerMode = String(getUserOnlySetting(config, 'providerMode', 'openai') || 'openai').trim();
  const providerBaseUrl = String(getUserOnlySetting(config, 'providerBaseUrl', '') || '').trim();
  const providerApiKeyEnv = String(getUserOnlySetting(config, 'providerApiKeyEnv', 'OPENAI_API_KEY') || 'OPENAI_API_KEY').trim();
  if (!['openai', 'openai-compatible'].includes(providerMode)) throw new Error('safeCodexPr.providerMode is invalid.');
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(providerApiKeyEnv)) throw new Error('safeCodexPr.providerApiKeyEnv is invalid.');
  const provider = providerMode === 'openai-compatible'
    ? { mode: providerMode, baseUrl: providerBaseUrl, apiKeyEnv: providerApiKeyEnv }
    : { mode: providerMode };
  const operationSeconds = clampNumber(
    getUserOnlySetting(config, 'operationTimeoutSeconds', 300),
    300, 30, 1200, 'operationTimeoutSeconds'
  );
  const requestSeconds = clampNumber(
    getUserOnlySetting(config, 'requestTimeoutSeconds', 180),
    180, 10, Math.min(900, operationSeconds), 'requestTimeoutSeconds'
  );
  const codexRuntime = normalizeCodexRuntimeOptions({
    provider,
    timeouts: {
      connectMs: clampNumber(getUserOnlySetting(config, 'connectTimeoutSeconds', 15), 15, 1, 120, 'connectTimeoutSeconds') * 1000,
      requestMs: requestSeconds * 1000,
      operationMs: operationSeconds * 1000,
      idleMs: clampNumber(getUserOnlySetting(config, 'streamIdleTimeoutSeconds', 60), 60, 5, 600, 'streamIdleTimeoutSeconds') * 1000
    }
  });

  const language = project.language ?? config.get('language', 'zh-CN');
  if (!['zh-CN', 'en'].includes(language)) throw new Error('safeCodexPr.language must be zh-CN or en.');

  const baseBranch = String(project.baseBranch ?? config.get('baseBranch', '') ?? '').trim();
  if (baseBranch.length > 256 || /[\r\n\0]/.test(baseBranch)) throw new Error('safeCodexPr.baseBranch is invalid.');

  const userInstructions = validateExtraInstructions(config.get('extraInstructions', ''));
  const repositoryInstructions = validateExtraInstructions(project.extraInstructions);

  return Object.freeze({
    codexPath,
    model,
    profile: profile.name,
    profileConfig: profile,
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
    codexRuntime,
    policySource: policy.source,
    policyFingerprint: policy.fingerprint
  });
}

module.exports = Object.freeze({
  getUserOnlySetting,
  readProjectRulesAtHead,
  effectiveOptions
});
