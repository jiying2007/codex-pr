'use strict';
const corePolicy=require('./codex-safe-core/policy');
const POLICY_FILE=corePolicy.POLICY_FILE;
const POLICY_SCHEMA_VERSION=corePolicy.POLICY_SCHEMA_VERSION;
const PROVENANCE=new Map([
  ['advisory',{review:false,commit:false}],
  ['require-review',{review:true,commit:false}],
  ['require-commit',{review:false,commit:true}],
  ['require-all',{review:true,commit:true}]
]);
function array(value){return Array.isArray(value)?value:[];}
function unique(values){return[...new Set(values)];}
function provenanceValue(value){return PROVENANCE.get(String(value||'advisory'))||PROVENANCE.get('advisory');}
function provenanceName(value){if(value.review&&value.commit)return'require-all';if(value.review)return'require-review';if(value.commit)return'require-commit';return'advisory';}
function tightenBoolean(localValue,committedValue,fallback=true){const local=localValue===undefined?fallback:Boolean(localValue);if(committedValue===undefined)return local;return Boolean(local||committedValue);}
function mergePolicy(local,committed){
  const lp=provenanceValue(local.provenancePolicy),cp=provenanceValue(committed.provenancePolicy);
  const mergedProv={review:lp.review||cp.review,commit:lp.commit||cp.commit};
  return{
    ...local,
    requiredChecks:unique([...array(committed.requiredChecks),...array(local.requiredChecks)]),
    requiredApprovals:Math.max(Number(committed.requiredApprovals||0),Number(local.requiredApprovals||0)),
    provenancePolicy:provenanceName(mergedProv),
    blockOnReviewFindings:tightenBoolean(local.blockOnReviewFindings,committed.blockOnReviewFindings,true),
    requireCleanWorktree:tightenBoolean(local.requireCleanWorktree,committed.requireCleanWorktree,true),
    requirePushedHead:tightenBoolean(local.requirePushedHead,committed.requirePushedHead,true),
    requireFreshTarget:tightenBoolean(local.requireFreshTarget,committed.requireFreshTarget,true),
    reviewers:unique([...array(committed.reviewers),...array(local.reviewers)]),
    labels:unique([...array(committed.labels),...array(local.labels)]),
    titlePolicy:committed.titlePolicy||local.titlePolicy||'create-only',
    managedSections:committed.managedSections===false?false:local.managedSections!==false,
    policySource:committed.__present?'committed+local-tightening':'local',
    policyFingerprint:committed.__fingerprint||'<none>',
    committedPolicy:committed.__present?committed:null
  };
}
async function resolveEffectiveConfig(git,localConfig,targetRef){
  const result=await corePolicy.readPolicySectionAtHead({
    git:async(args,_repoRoot,_token,options={})=>({stdout:await git.run(args,{allowFailure:false,signal:options.signal}),stderr:''}),
    repoRoot:git.cwd||'.',
    headOid:targetRef,
    section:'change'
  });
  const committed={...result.rules};
  if(result.source==='head-policy'){committed.__present=true;committed.__fingerprint=result.fingerprint;}
  return mergePolicy(localConfig,committed);
}
module.exports={POLICY_FILE,POLICY_SCHEMA_VERSION,mergePolicy,resolveEffectiveConfig,provenanceValue,provenanceName,tightenBoolean};
