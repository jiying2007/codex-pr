'use strict';

const { runPreparedProcess } = require('./process');
const { buildPrompt, outputSchema, buildCodexInput, validateStructuredResult } = require('./core');
const { isCliCompatibilityError } = require('./safe-contract');
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
  return { result: validateStructuredResult(parsed), codexVersion: resolved.version };
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
