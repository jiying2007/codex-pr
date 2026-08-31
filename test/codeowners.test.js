'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseCodeowners, ownersForPath, suggestReviewers } = require('../src/codeowners');
test('CODEOWNERS applies last matching rule and deduplicates users', () => {
  const rules = parseCodeowners('*.js @alice\nsrc/** @bob\nsrc/audio/** @carol @alice\n/team/** @org/team');
  assert.deepEqual(ownersForPath('src/audio/a.js', rules), ['carol', 'alice']);
  assert.deepEqual(ownersForPath('src/core/a.js', rules), ['bob']);
  assert.deepEqual(suggestReviewers(['src/audio/a.js', 'src/core/a.js'], rules, ['alice']), ['alice', 'carol', 'bob']);
});
