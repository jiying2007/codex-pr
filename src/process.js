'use strict';

const { createProcessRunner } = require('./codex-safe-core/process-runner');

const runner = createProcessRunner((_zh, en) => en);

module.exports = Object.freeze({
  isWindowsScript: runner.isWindowsScript,
  quoteWindowsCmdArg: runner.quoteWindowsCmdArg,
  prepareCommand: runner.prepareCommand,
  runPreparedProcess: runner.runPreparedProcess,
  runProcess: runner.runProcess,
  runProcessBuffer: runner.runProcessBuffer
});
