'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runProcess, runPreparedProcess } = require('./process');
const { buildPrompt, outputSchema, buildCodexArgs, buildCodexInput, parseCodexJsonl, validateStructuredResult } = require('./core');

const capabilityCache = new Map();

async function findWindowsCodexCandidates(codexPath) {
  if (process.platform !== 'win32' || codexPath !== 'codex') return [codexPath];
  const candidates = [];
  try {
    const { stdout } = await runProcess('where.exe', ['codex'], { timeoutMs: 5000 });
    for (const line of stdout.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) if (!candidates.includes(line)) candidates.push(line);
  } catch {}
  for (const fallback of ['codex.exe', 'codex.cmd', 'codex.bat', 'codex']) if (!candidates.includes(fallback)) candidates.push(fallback);
  candidates.sort((a, b) => {
    const rank = x => /\.exe$/i.test(x) ? 0 : /\.(cmd|bat)$/i.test(x) ? 1 : 2;
    return rank(a) - rank(b);
  });
  return candidates;
}

async function resolveCodexExecutable(codexPath) {
  const candidates = await findWindowsCodexCandidates(codexPath);
  const windowsDefaultLookup = process.platform === 'win32' && codexPath === 'codex';
  let lastError;
  for (const candidate of candidates) {
    try {
      const result = await runPreparedProcess(candidate, ['--version'], { timeoutMs: 10000 });
      const version = (result.stdout || result.stderr).trim();
      if (!version) throw new Error(`Codex CLI ${candidate} returned no version information from --version.`);
      return { executable: candidate, version };
    } catch (error) {
      lastError = error;
      if (windowsDefaultLookup) continue;
      if (error?.code === 'ENOENT') break;
      const detail = error?.stderr || error?.stdout || error?.message || String(error);
      const wrapped = new Error(`Codex CLI failed to run: ${candidate}. Make sure "${candidate} --version" succeeds. Original error: ${detail}`);
      wrapped.code = 'ECODEXUNUSABLE';
      wrapped.cause = error;
      throw wrapped;
    }
  }
  const detail = lastError?.stderr || lastError?.stdout || lastError?.message || '';
  const error = new Error(`No usable Codex CLI was found for: ${codexPath}. Make sure "codex --version" succeeds.${detail ? ` Original error: ${detail}` : ''}`);
  error.code = 'ECODEXNOTFOUND';
  throw error;
}

function helpHas(text, flag) {
  return String(text || '').includes(flag);
}

async function probeCodexCapabilities(resolved, model = '') {
  const cacheKey = `${resolved.executable}\n${resolved.version}\n${model ? 'model' : 'default'}`;
  if (capabilityCache.has(cacheKey)) return capabilityCache.get(cacheKey);

  let topHelp;
  let execHelp;
  try {
    const [top, exec] = await Promise.all([
      runPreparedProcess(resolved.executable, ['--help'], { timeoutMs: 10000, maxStdoutBytes: 1024 * 1024, maxStderrBytes: 256 * 1024 }),
      runPreparedProcess(resolved.executable, ['exec', '--help'], { timeoutMs: 10000, maxStdoutBytes: 1024 * 1024, maxStderrBytes: 256 * 1024 })
    ]);
    topHelp = `${top.stdout}\n${top.stderr}`;
    execHelp = `${exec.stdout}\n${exec.stderr}`;
  } catch (error) {
    const wrapped = new Error(`Unable to inspect Codex CLI capabilities for ${resolved.version}. Make sure "codex --help" and "codex exec --help" succeed.`);
    wrapped.code = 'ECODEXCAPABILITY';
    wrapped.cause = error;
    throw wrapped;
  }

  const missing = [];
  if (!helpHas(topHelp, '--ask-for-approval')) missing.push('top-level --ask-for-approval');
  for (const flag of ['--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--sandbox', '--output-schema']) {
    if (!helpHas(execHelp, flag)) missing.push(`exec ${flag}`);
  }
  const combined = `${topHelp}\n${execHelp}`;
  if (!helpHas(combined, '--config')) missing.push('--config');
  if (model && !helpHas(combined, '--model')) missing.push('--model');

  if (missing.length) {
    const error = new Error(`Codex CLI ${resolved.version} does not expose required capabilities: ${missing.join(', ')}.`);
    error.code = 'ECODEXCAPABILITY';
    throw error;
  }

  const result = { ...resolved, capabilitiesVerified: true };
  capabilityCache.set(cacheKey, result);
  return result;
}

function isCliCompatibilityError(error) {
  const text = `${error?.stderr || ''}\n${error?.stdout || ''}\n${error?.message || ''}`.toLowerCase();
  return text.includes('unexpected argument') || text.includes('unknown argument') || text.includes('unrecognized option') || text.includes('unknown option');
}

async function withTemporaryDirectory(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-pr-'));
  try { return await fn(tempDir); }
  finally { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} }
}

async function runCodex(context, options, previousResult, token) {
  const resolved = await resolveCodexExecutable(options.codexPath);
  await probeCodexCapabilities(resolved, options.model);
  const prompt = buildPrompt(options, context, previousResult);
  const stdin = buildCodexInput(prompt, context, previousResult);
  return withTemporaryDirectory(async tempDir => {
    const schemaPath = path.join(tempDir, 'pr-schema.json');
    fs.writeFileSync(schemaPath, JSON.stringify(outputSchema()), { encoding: 'utf8', mode: 0o600 });
    const args = buildCodexArgs(schemaPath, options.model);
    let processResult;
    try {
      processResult = await runPreparedProcess(resolved.executable, args, {
        cwd: tempDir,
        timeoutMs: options.timeoutSeconds * 1000,
        maxStdoutBytes: 4 * 1024 * 1024,
        maxStderrBytes: 1024 * 1024
      }, stdin, token);
    } catch (error) {
      if (isCliCompatibilityError(error)) {
        const wrapped = new Error(`The current Codex CLI is incompatible with the safety/structured-output arguments required by Codex PR Safe. Use a Codex CLI version that exposes the required capabilities. Original error: ${error.stderr || error.message}`);
        wrapped.code = 'ECODEXVERSION';
        throw wrapped;
      }
      throw error;
    }
    const agentText = parseCodexJsonl(processResult.stdout);
    let parsed;
    try { parsed = JSON.parse(agentText); }
    catch { throw new Error('The final Codex agent_message is not JSON matching the output schema.'); }
    return { result: validateStructuredResult(parsed), codexVersion: resolved.version };
  });
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