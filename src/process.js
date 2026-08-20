'use strict';

const { spawn } = require('child_process');

function isWindowsScript(command) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
}

function quoteWindowsCmdArg(value) {
  const s = String(value);
  const escaped = s
    .replace(/\^/g, '^^')
    .replace(/%/g, '%%')
    .replace(/!/g, '^^!')
    .replace(/"/g, '""')
    .replace(/([&|<>])/g, '^$1');
  return `"${escaped}"`;
}

function prepareCommand(command, args) {
  if (!isWindowsScript(command)) return { command, args, shell: false, windowsVerbatimArguments: false };
  const commandLine = '"' + [quoteWindowsCmdArg(command), ...args.map(quoteWindowsCmdArg)].join(' ') + '"';
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', commandLine],
    shell: false,
    windowsVerbatimArguments: true
  };
}

function runProcess(command, args, options = {}, stdinText = '', cancellationToken) {
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let timeoutHandle;
    let forceKillHandle;
    let cancellationDisposable;
    let terminating = false;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (forceKillHandle) clearTimeout(forceKillHandle);
      cancellationDisposable?.dispose();
    };
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const terminate = error => {
      if (terminating) return;
      terminating = true;
      if (!child || child.killed) return settle(reject, error);
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
        killer.once('close', () => settle(reject, error));
        killer.once('error', () => { try { child.kill(); } catch {} settle(reject, error); });
        return;
      }
      try { if (child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
      forceKillHandle = setTimeout(() => {
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
        settle(reject, error);
      }, 1500);
    };

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        windowsHide: true,
        shell: options.shell === true,
        windowsVerbatimArguments: options.windowsVerbatimArguments === true,
        detached: process.platform !== 'win32'
      });
    } catch (error) {
      settle(reject, error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const maxStdoutBytes = options.maxStdoutBytes ?? 4 * 1024 * 1024;
    const maxStderrBytes = options.maxStderrBytes ?? 1024 * 1024;

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      stdoutBytes += Buffer.byteLength(chunk, 'utf8');
      if (stdoutBytes > maxStdoutBytes) return terminate(Object.assign(new Error(`stdout exceeded ${maxStdoutBytes} bytes`), { code: 'EOUTPUTLIMIT' }));
      stdout += chunk;
    });
    child.stderr?.on('data', chunk => {
      stderrBytes += Buffer.byteLength(chunk, 'utf8');
      if (stderrBytes > maxStderrBytes) return terminate(Object.assign(new Error(`stderr exceeded ${maxStderrBytes} bytes`), { code: 'EOUTPUTLIMIT' }));
      stderr += chunk;
    });
    child.stdin?.on('error', error => {
      if (error?.code !== 'EPIPE' && !settled) settle(reject, error);
    });

    child.once('error', error => settle(reject, error));
    child.once('close', (code, signal) => {
      if (settled || terminating) return;
      if (code === 0) return settle(resolve, { stdout, stderr, code, signal });
      const error = new Error(`Command failed (${code ?? signal}): ${command}`);
      error.code = code;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      settle(reject, error);
    });

    if (stdinText) child.stdin?.end(stdinText, 'utf8'); else child.stdin?.end();

    if (options.timeoutMs) {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`Command timed out after ${options.timeoutMs} ms: ${command}`);
        error.code = 'ETIMEDOUT';
        terminate(error);
      }, options.timeoutMs);
    }
    if (cancellationToken) {
      if (cancellationToken.isCancellationRequested) return terminate(Object.assign(new Error('Operation cancelled'), { code: 'ECANCELLED' }));
      cancellationDisposable = cancellationToken.onCancellationRequested(() => terminate(Object.assign(new Error('Operation cancelled'), { code: 'ECANCELLED' })));
    }
  });
}

function runPreparedProcess(command, args, options = {}, stdinText = '', cancellationToken) {
  const prepared = prepareCommand(command, args);
  return runProcess(prepared.command, prepared.args, {
    ...options,
    shell: false,
    windowsVerbatimArguments: prepared.windowsVerbatimArguments
  }, stdinText, cancellationToken);
}

module.exports = { isWindowsScript, quoteWindowsCmdArg, prepareCommand, runProcess, runPreparedProcess };