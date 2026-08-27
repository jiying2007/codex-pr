'use strict';

const path = require('node:path');
const { git, readHeadBlob } = require('./git-domain');
const { extractImpactSignals, buildImpactEvidenceGraph } = require('./codex-safe-core/quality-platform');

const MAX_SCAN_FILES = 512;
const MAX_READ_CANDIDATES = 64;
const MAX_CANDIDATE_BYTES = 96 * 1024;

function textCandidate(file) {
  return !/(?:^|\/)(?:node_modules|dist|build|vendor)\//i.test(file) &&
    !/\.(?:png|jpe?g|gif|webp|pdf|zip|gz|xz|7z|bin|so|dll|exe|woff2?)$/i.test(file);
}

function cheapScore(file, signals) {
  const low = String(file).toLowerCase();
  const base = path.posix.basename(low);
  const stem = base.replace(/\.[^.]+$/, '');
  let score = 0;
  if (signals.paths.includes(file)) score += 100;
  for (const inc of signals.includes) if (low.endsWith(String(inc).toLowerCase())) score += 40;
  for (const mod of signals.modules) {
    const normalized = String(mod).replace(/^\.\//, '').replace(/\./g, '/').toLowerCase();
    if (normalized && (low.includes(normalized) || base.startsWith(path.posix.basename(normalized)))) score += 30;
  }
  if (signals.changedStems.includes(stem)) score += 10;
  if (/^(?:cmakelists\.txt|makefile|kconfig|meson\.build|build(?:\.bazel)?)$/i.test(base)) score += 8;
  if (/\.(?:c|cc|cpp|cxx|h|hh|hpp|rs|js|ts|tsx|py|java|kt|dts|dtsi|yaml|yml)$/i.test(file)) score += 2;
  return score;
}

async function collectPrImpactEvidence(root, diff, profile, token) {
  if (!profile || profile.impactDepth <= 0 || profile.maxImpactFiles <= 0) {
    return Object.freeze({ nodes: [], edges: [], text: '', bytes: 0, complete: true, truncated: false });
  }
  const signals = extractImpactSignals(diff);
  const { stdout } = await git(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], { maxStdoutBytes: 8 * 1024 * 1024 }, token);
  const ranked = stdout.split('\0').filter(Boolean).filter(textCandidate)
    .map(file => ({ file, score: cheapScore(file, signals) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, MAX_SCAN_FILES);

  const candidates = [];
  for (const item of ranked.slice(0, MAX_READ_CANDIDATES)) {
    if (item.score <= 0) break;
    const blob = await readHeadBlob(root, item.file, MAX_CANDIDATE_BYTES, token);
    if (!blob || blob.symlink || blob.tooLarge || typeof blob.text !== 'string') continue;
    candidates.push({ path: item.file, content: blob.text });
  }

  return buildImpactEvidenceGraph({
    diff,
    candidates,
    maxNodes: profile.maxImpactFiles,
    maxEdges: Math.max(32, profile.maxImpactFiles * 6),
    maxBytes: Math.min(256 * 1024, Math.max(32 * 1024, profile.maxImpactFiles * 12 * 1024))
  });
}

module.exports = Object.freeze({ textCandidate, cheapScore, collectPrImpactEvidence });
