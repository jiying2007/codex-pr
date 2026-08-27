'use strict';

const domain = require('./git-domain');
const { buildSemanticContext } = require('./codex-safe-core/context-builder');

const RAW_DIFF_HARD_LIMIT = 8 * 1024 * 1024;

function pathsFromNameStatus(value) {
  const paths = [];
  for (const line of String(value || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split('\t').filter(Boolean);
    if (fields.length < 2) continue;
    const status = fields[0];
    if (/^[RC]/.test(status) && fields.length >= 3) paths.push(fields[2]);
    else paths.push(fields[1]);
  }
  return Array.from(new Set(paths));
}

async function collectPrContext(root, baseRef, options, token) {
  const collectionLimit = Math.min(
    RAW_DIFF_HARD_LIMIT,
    Math.max(2 * 1024 * 1024, Number(options.maxDiffBytes || 0) * 8)
  );
  const raw = await domain.collectPrContext(
    root,
    baseRef,
    { ...options, maxDiffBytes: collectionLimit },
    token
  );
  const semantic = buildSemanticContext({
    files: pathsFromNameStatus(raw.nameStatus),
    diff: raw.diff,
    maxBytes: options.maxDiffBytes
  });
  return Object.freeze({
    ...raw,
    diff: semantic.text,
    diffBudget: semantic
  });
}

module.exports = Object.freeze({
  ...domain,
  collectPrContext,
  pathsFromNameStatus,
  RAW_DIFF_HARD_LIMIT
});
