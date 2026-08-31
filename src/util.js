'use strict';
const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value), 'utf8').digest('hex');
}
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function normalizeBranch(value) { return String(value || '').trim().replace(/^refs\/heads\//, ''); }
function truncate(value, max) { const s = String(value || ''); return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`; }
function assertSafeUrl(value, allowInsecureHttp = false) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowInsecureHttp && url.protocol === 'http:')) {
    const error = new Error(`Refusing insecure SCM URL: ${url.origin}`);
    error.code = 'EINSECURESCM';
    throw error;
  }
  if (url.username || url.password) {
    const error = new Error('SCM URL must not embed credentials');
    error.code = 'EEMBEDDEDCREDENTIALS';
    throw error;
  }
  return url;
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
module.exports = { sha256, unique, normalizeBranch, truncate, assertSafeUrl, stableJson };
