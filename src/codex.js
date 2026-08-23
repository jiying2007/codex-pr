'use strict';

const { runPreparedProcess } = require('./process');
const { buildPrompt, outputSchema, buildCodexInput, validateStructuredResult } = require('./pr-domain');
const { SAFE_CORE_VERSION, SAFE_CONTRACT_VERSION, PR_PROMPT_CONTRACT_VERSION, isCliCompatibilityError } = require('./codex-safe-core/safe-contract');
const { POLICY_SCHEMA_VERSION } = require('./codex-safe-core/policy');
const { createCodexCli } = require('./codex-safe-core/codex-cli');

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

async function runCodex(context, options, previousResult, token) {
  const prompt = buildPrompt(options, context, previousResult);
  const input = buildCodexInput(prompt, context, previousResult);
  const { parsed, resolved } = await sharedCodexCli.runStructuredCodex({
    codexPath: options.codexPath,
    model: options.model,
    timeoutMs: options.timeoutSeconds * 1000,
    schema: outputSchema(),
    input,
    schemaFileName: 'pr-schema.json',
    token,
    maxStdoutBytes: 4 * 1024 * 1024,
    maxStderrBytes: 1024 * 1024
  });
  const result = validateStructuredResult(parsed);
  const provenance = Object.freeze({
    safeCoreVersion: SAFE_CORE_VERSION,
    safeContractVersion: SAFE_CONTRACT_VERSION,
    policySchemaVersion: POLICY_SCHEMA_VERSION,
    promptContractVersion: PR_PROMPT_CONTRACT_VERSION,
    codexVersion: resolved.version || 'unknown',
    requestedModel: options.model || '',
    resolvedModel: options.model || 'cli-default'
  });
  return { result, codexVersion: provenance.codexVersion, provenance };
}

module.exports = {
  findWindowsCodexCandidates,
  resolveCodexExecutable,
  probeCodexCapabilities,
  isCliCompatibilityError,
  withTemporaryDirectory,
  runCodex,
  _capabilityCache: capabilityCache
};
