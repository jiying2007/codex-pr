'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { upsertManagedBody } = require('../src/managed-sections');
test('managed sections preserve human prose and update idempotently', () => {
  const first = upsertManagedBody('Human context\nDo not overwrite.', { summary: 'one', evidence: 'e1' });
  const second = upsertManagedBody(first, { summary: 'two', evidence: 'e2' });
  assert.match(second, /Human context\nDo not overwrite\./); assert.match(second, /summary:start -->\ntwo/); assert.doesNotMatch(second, /summary:start -->\none/); assert.equal((second.match(/summary:start/g) || []).length, 1);
});
