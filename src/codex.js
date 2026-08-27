'use strict';

const { runPreparedProcess } = require('./process');
const { buildPrompt, outputSchema, buildCodexInput, validateStructuredResult } = require('./pr-domain');
const { SAFE_CORE_VERSION, SAFE_CONTRACT_VERSION, PR_PROMPT_CONTRACT_VERSION, isCliCompatibilityError } = require('./codex-safe-core/safe-contract');
const { POLICY_SCHEMA_VERSION } = require('./codex-safe-core/policy');
const { createCodexCli } = require('./codex-safe-core/codex-cli');
const { buildSemanticContext, splitUnifiedDiff } = require('./codex-safe-core/context-builder');
const { scoreEvidenceRisk, adaptiveBudget, selectModel } = require('./codex-safe-core/efficiency-planner');

const capabilityCache = new Map();
const sharedCodexCli = createCodexCli({
  runPreparedProcess,
  tempPrefix: 'codex-pr-',
  capabilityCache
});

const findWindowsCodexCandidates = sharedCodexCli.findWindowsCodexCandidates;
const resolveCodexExecutable = sharedCodexCli.resolveCodexExecutable;
const probeCodexCapabilities = sharedCodexCli.probeCodexCapabilities;
const withTemporaryDirectory = sharedCodexCli.withTemporaryDirectory;

function automaticTokenBudget(options = {}) {
  const boundedInputBytes = Number(options.maxDiffBytes || 0) + Number(options.maxCommitBytes || 0) + 64 * 1024;
  return Math.max(12000, Math.ceil(boundedInputBytes / 2) + 6000);
}

async function runCodex(context, options, previousResult, token) {
  const prompt = buildPrompt(options, context, previousResult);
  const paths = splitUnifiedDiff(context.diff).map(block => block.path);
  const riskScore = scoreEvidenceRisk({ paths, text: context.diff });
  const contextBudgetBytes = adaptiveBudget(options.maxDiffBytes, riskScore, { lowFactor: 0.4, mediumFactor: 0.7, min: 24 * 1024 });
  const semanticContext = buildSemanticContext({ diff: context.diff, maxBytes: contextBudgetBytes });
  const plannedContext = { ...context, diff: semanticContext.text };
  const input = buildCodexInput(prompt, plannedContext, previousResult);
  const model = selectModel({ model: options.model, fastModel: options.fastModel, riskScore });
  const execution = await sharedCodexCli.runStructuredCodex({
    codexPath: options.codexPath,
    model,
    timeoutMs: options.timeoutSeconds * 1000,
    schema: outputSchema(),
    input,
    schemaFileName: 'pr-schema.json',
    token,
    maxStdoutBytes: 4 * 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEstimatedTokens: Number(options.maxTokenBudget) > 0 ? Number(options.maxTokenBudget) : automaticTokenBudget(options),
    estimatedOutputTokens: 3000
  });
  const result = validateStructuredResult(execution.parsed);
  const provenance = Object.freeze({
    safeCoreVersion: SAFE_CORE_VERSION,
    safeContractVersion: SAFE_CONTRACT_VERSION,
    policySchemaVersion: POLICY_SCHEMA_VERSION,
    promptContractVersion: PR_PROMPT_CONTRACT_VERSION,
    codexVersion: execution.resolved.version || 'unknown',
    requestedModel: options.model || '',
    resolvedModel: model || 'cli-default',
    riskScore,
    contextBudgetBytes,
    inputDiffBytes: semanticContext.inputDiffBytes,
    requestEstimate: execution.requestEstimate,
    usage: execution.usage,
    durationMs: execution.durationMs
  });
  return { result, codexVersion: provenance.codexVersion, provenance };
}

module.exports = {
  automaticTokenBudget,
  findWindowsCodexCandidates,
  resolveCodexExecutable,
  probeCodexCapabilities,
  isCliCompatibilityError,
  withTemporaryDirectory,
  runCodex,
  _capabilityCache: capabilityCache
};
