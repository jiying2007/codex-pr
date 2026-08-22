'use strict';

const { createProcessRunner } = require('./codex-safe-core/process-runner');

const runner = createProcessRunner();

module.exports = Object.freeze({
  isWindowsScript: runner.isWindowsScript,
  quoteWindowsCmdArg: runner.quoteWindowsCmdArg,
  prepareCommand: runner.prepareCommand,
  runProcess: runner.runPreparedProcess,
  runProcessBuffer: runner.runProcessBuffer
});
