'use strict';

const domain = require('./pr-domain');
const { POLICY_FILE, validatePolicyDocument } = require('./codex-safe-core/policy');

const PR_RULE_KEYS = new Set([
  'language',
  'baseBranch',
  'maxDiffBytes',
  'maxCommitBytes',
  'titleMaxLength',
  'maxBodyChars',
  'includePullRequestTemplate',
  'extraInstructions',
  'timeoutSeconds'
]);

function validateProjectRulesObject(value) {
  const document = validatePolicyDocument(value);
  const rules = document.pr || {};
  const unknown = Object.keys(rules).filter(key => !PR_RULE_KEYS.has(key));
  if (unknown.length) throw new Error(`${POLICY_FILE}.pr contains unsupported fields: ${unknown.join(', ')}`);
  if (rules.language !== undefined && !['zh-CN', 'en'].includes(rules.language)) throw new Error(`${POLICY_FILE}.pr.language must be zh-CN or en.`);
  if (rules.baseBranch !== undefined && typeof rules.baseBranch !== 'string') throw new Error(`${POLICY_FILE}.pr.baseBranch must be a string.`);
  if (rules.includePullRequestTemplate !== undefined && typeof rules.includePullRequestTemplate !== 'boolean') throw new Error(`${POLICY_FILE}.pr.includePullRequestTemplate must be a boolean.`);
  if (rules.extraInstructions !== undefined) domain.validateExtraInstructions(rules.extraInstructions);
  return rules;
}

module.exports = Object.freeze({
  ...domain,
  PROJECT_RULES_FILE: POLICY_FILE,
  validateProjectRulesObject
});
