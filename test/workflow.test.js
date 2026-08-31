'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { applyProvenancePolicy } = require('../src/workflow');
const base={state:'READY',blockers:[],warnings:[],commits:[{sha:'a'},{sha:'b'}]};
test('blocking review evidence blocks delivery by default',()=>{ const p=applyProvenancePolicy(base,{reviewStatus:'available',reviewReceipts:2,commitStatus:'available',commitReceipts:2,blockedReviewCommits:1,incompleteReviewCommits:0,needsEvidenceReviewCommits:0},{provenancePolicy:'advisory',blockOnReviewFindings:true}); assert.equal(p.state,'BLOCKED'); assert.equal(p.blockers[0].code,'review_provenance_blocked'); });
test('require-all fails closed on incomplete provenance',()=>{ const p=applyProvenancePolicy(base,{reviewStatus:'available',reviewReceipts:1,commitStatus:'available',commitReceipts:2,blockedReviewCommits:0,incompleteReviewCommits:0,needsEvidenceReviewCommits:0},{provenancePolicy:'require-all'}); assert.equal(p.state,'BLOCKED'); assert.ok(p.blockers.some(x=>x.code==='review_provenance_incomplete')); });
