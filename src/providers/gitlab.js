'use strict';
const { HttpClient }=require('../http-client'); const { unique }=require('../util');
function enc(v){return encodeURIComponent(String(v));} function parseVersion(v){const m=String(v||'').match(/^(\d+)\.(\d+)\.(\d+)/);return m?m.slice(1).map(Number):null;} function versionAtLeast(v,min){const a=parseVersion(v),b=parseVersion(min);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]>b[i])return true;if(a[i]<b[i])return false;}return true;}
function checkState(status,allowFailure=false){const s=String(status||'').toLowerCase();if(['success','skipped'].includes(s))return'success';if(s==='manual')return allowFailure?'success':'pending';if(['failed','canceled','canceling'].includes(s))return allowFailure?'success':'failure';if(['running','pending','created','preparing','waiting_for_resource','waiting_for_callback','scheduled'].includes(s))return'pending';return'failure';} function jobCheckState(j){return checkState(j?.status,j?.allow_failure===true);} function externalState(s){return s==='passed'?'success':s==='pending'?'pending':'failure';}
function changeIdentityError(message){return Object.assign(new Error(message),{code:'ECHANGEIDENTITY'});}
function verifiedProjectId(value){
 const raw=String(value??'');
 const id=Number(raw);
 if(!/^[1-9][0-9]*$/.test(raw)||!Number.isSafeInteger(id))throw changeIdentityError('GitLab project identity could not be verified.');
 return id;
}
function confirmedHeadOid(change){
 const direct=change?.sha, diffHead=change?.diff_refs?.head_sha;
 const sha=direct||diffHead||'';
 const valid=value=>typeof value==='string'&&/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
 if(!valid(sha)||(direct&&!valid(direct))||(diffHead&&!valid(diffHead))||(direct&&diffHead&&direct!==diffHead))throw Object.assign(new Error('Confirmed GitLab MR head OID is missing, malformed or inconsistent; refresh and confirm again.'),{code:'EHEADBOUND'});
 return sha;
}
const WAITING=new Set(['approvals_syncing','checking','ci_still_running','merge_time','not_approved','preparing','security_policy_pipeline_check','status_checks_must_pass','unchecked','cannot_be_merged_recheck']);
const BLOCKED=new Set(['ci_must_pass','commits_status','conflict','discussions_not_resolved','draft_status','jira_association_missing','locked_lfs_files','merge_request_blocked','need_rebase','not_open','policies_denied','requested_changes','security_policy_violations','title_regex','cannot_be_merged']);
class GitLabProvider{
 constructor({remote,sourceRemote,apiBaseUrl,token,timeoutMs,allowInsecureHttp,tokenEnvName='GITLAB_TOKEN'}){this.kind='gitlab';this.remote=remote;this.targetRemote=remote;this.sourceRemote=sourceRemote||remote;this.project=remote.projectPath;this.hasToken=Boolean(token);this.tokenEnvName=tokenEnvName;this.client=new HttpClient({baseUrl:apiBaseUrl,token,tokenHeader:'PRIVATE-TOKEN',timeoutMs,allowInsecureHttp,userAgent:'codex-change-safe/5 gitlab'});}
 path(suffix='',remote=this.targetRemote){return`/projects/${enc(remote.projectPath)}${suffix}`;}
 async projectInfo(remote=this.targetRemote){const key=remote.projectPath;if(!this._projects)this._projects=new Map();if(!this._projects.has(key))this._projects.set(key,(await this.client.request('GET',this.path('',remote))).data);return this._projects.get(key);}
 async getDefaultBranch(){return(await this.projectInfo()).default_branch||'';}
 async getVersion(){if(this.versionInfo)return this.versionInfo;this.versionInfo=(await this.client.request('GET','/version')).data;return this.versionInfo;}
 async validateCompatibility(){const info=await this.getVersion(),version=String(info?.version||'');if(!parseVersion(version))throw Object.assign(new Error('GitLab version could not be determined safely.'),{code:'EGITLABVERSION'});if(!versionAtLeast(version,'14.6.1'))throw Object.assign(new Error(`GitLab ${version} is below supported minimum 14.6.1.`),{code:'EGITLABVERSION'});return{version,autoMergeParameter:versionAtLeast(version,'17.11.0')?'auto_merge':'merge_when_pipeline_succeeds'};}
 async getSourceBranchSha(branch){const r=await this.client.request('GET',this.path(`/repository/branches/${enc(branch)}`,this.sourceRemote));return r.data?.commit?.id||'';} async getTargetBranchSha(branch){const r=await this.client.request('GET',this.path(`/repository/branches/${enc(branch)}`));return r.data?.commit?.id||'';} getBranchSha(branch){return this.getTargetBranchSha(branch);}
 async findOpenChangeRequest(sourceBranch,targetBranch){
  const [source,target]=await Promise.all([this.projectInfo(this.sourceRemote),this.projectInfo(this.targetRemote)]);
  const sourceId=verifiedProjectId(source?.id),targetId=verifiedProjectId(target?.id);
  const result=await this.client.paginate(this.path('/merge_requests'),{state:'opened',source_branch:sourceBranch,target_branch:targetBranch,scope:'all'});
  if(!result.complete)throw Object.assign(new Error('Could not exhaustively scan open merge requests.'),{code:'ESCMPAGINATION'});
  const matches=[];
  for(const item of result.items){
   if(verifiedProjectId(item?.source_project_id)!==sourceId||verifiedProjectId(item?.target_project_id)!==targetId)continue;
   if(item.source_branch!==sourceBranch||item.target_branch!==targetBranch)throw changeIdentityError('GitLab returned inconsistent merge request branch identity.');
   matches.push(item);
  }
  if(matches.length>1)throw changeIdentityError('Multiple open merge requests match the confirmed source and target; select the request explicitly.');
  return matches[0]||null;
 }
 async createChangeRequest({sourceBranch,targetBranch,title,body,draft}){const effectiveTitle=draft&&!/^\s*(draft:|wip:)/i.test(title)?`Draft: ${title}`:title;const source=await this.projectInfo(this.sourceRemote),target=await this.projectInfo(this.targetRemote);const sourceId=verifiedProjectId(source?.id),targetId=verifiedProjectId(target?.id);const cross=sourceId!==targetId;const endpoint=cross?this.path('/merge_requests',this.sourceRemote):this.path('/merge_requests');const payload={source_branch:sourceBranch,target_branch:targetBranch,title:effectiveTitle,description:body,allow_collaboration:true};if(cross)payload.target_project_id=targetId;return(await this.client.request('POST',endpoint,{body:payload,expected:[201]})).data;}
 async updateChangeRequest(iid,{title,body}){const payload={description:body};if(title!==undefined)payload.title=title;return(await this.client.request('PUT',this.path(`/merge_requests/${iid}`),{body:payload})).data;}
 async getChangeRequest(iid){return(await this.client.request('GET',this.path(`/merge_requests/${iid}`),{query:{include_diverged_commits_count:true}})).data;}
 async listPipelines(iid){const r=await this.client.paginate(this.path(`/merge_requests/${iid}/pipelines`));if(!r.complete)throw Object.assign(new Error('Could not exhaustively scan merge request pipelines.'),{code:'ESCMPAGINATION'});return r.items;}
 async listChecks(iid,expectedHead){
  const unbound=message=>Object.assign(new Error(message),{code:'EPIPELINEBOUND'});
  const validOid=value=>typeof value==='string'&&/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
  const mr=await this.getChangeRequest(iid);
  const head=confirmedHeadOid(mr);
  if(!validOid(expectedHead)||head!==expectedHead||String(mr.iid)!==String(iid))throw unbound('GitLab MR head changed or is unbound; refresh readiness.');
  const pipeline=mr.head_pipeline;
  if(!pipeline){
   // Listing MR pipelines may include old successful revisions. Absence of
   // the authoritative head_pipeline is not permission to select one.
   const history=await this.listPipelines(iid);
   if(history.length)throw unbound('GitLab MR has pipeline history but no authoritative head pipeline.');
   return [];
  }
  const pipelineId=verifiedProjectId(pipeline.id),projectId=verifiedProjectId(pipeline.project_id);
  const sourceId=verifiedProjectId(mr.source_project_id),targetId=verifiedProjectId(mr.target_project_id);
  const [source,target]=await Promise.all([this.projectInfo(this.sourceRemote),this.projectInfo(this.targetRemote)]);
  if(sourceId!==verifiedProjectId(source?.id)||targetId!==verifiedProjectId(target?.id)||(projectId!==sourceId&&projectId!==targetId))throw unbound('GitLab pipeline project is outside the confirmed MR topology.');
  if(!validOid(pipeline.sha))throw unbound('GitLab head pipeline has no valid commit SHA.');
  const pipelinePath='/projects/'+enc(projectId)+'/pipelines/'+pipelineId;
  let targetHead='';
  if(pipeline.sha===head){
   if(pipeline.ref!==mr.source_branch&&pipeline.ref!=='refs/merge-requests/'+iid+'/head')throw unbound('GitLab source pipeline ref does not identify the confirmed MR.');
  }else{
   // A merged-results pipeline runs on a synthetic commit, not the source
   // SHA. Only an exact two-parent merge of the current target and source
   // can qualify. Merge trains with additional predecessors are not inferred.
   if(pipeline.source!=='merge_request_event'||pipeline.ref!=='refs/merge-requests/'+iid+'/merge')throw unbound('GitLab head pipeline does not bind the current source SHA; synthetic pipeline identity is unproven.');
   targetHead=await this.getTargetBranchSha(mr.target_branch);
   if(!validOid(targetHead))throw unbound('GitLab current target HEAD is unknown.');
   const commit=(await this.client.request('GET','/projects/'+enc(projectId)+'/repository/commits/'+enc(pipeline.sha))).data;
   if(commit?.id!==pipeline.sha||!Array.isArray(commit.parent_ids)||commit.parent_ids.length!==2||commit.parent_ids[0]!==targetHead||commit.parent_ids[1]!==head)throw unbound('GitLab merged-results pipeline parents do not match current target and source.');
  }
  const probe=await this.client.request('GET',pipelinePath+'/jobs',{query:{per_page:100,page:1,include_retried:false},expected:[200,403,404]});
  let checks=[];
  if(probe.status===200){
   const paged=await this.client.paginate(pipelinePath+'/jobs',{include_retried:false});
   if(!paged.complete)throw Object.assign(new Error('Could not exhaustively scan pipeline jobs.'),{code:'ESCMPAGINATION'});
   if(paged.items.length)checks=paged.items.map(j=>({name:j.name,state:jobCheckState(j),url:j.web_url||'',pipelineId,jobId:j.id,allowFailure:j.allow_failure===true}));
  }
  if(!checks.length)checks=[{name:'pipeline:'+pipelineId,state:checkState(pipeline.status),url:pipeline.web_url||'',pipelineId}];
  const final=await this.getChangeRequest(iid),latest=final.head_pipeline;
  if(confirmedHeadOid(final)!==head||String(final.iid)!==String(iid)||final.source_branch!==mr.source_branch||final.target_branch!==mr.target_branch||Number(final.source_project_id)!==sourceId||Number(final.target_project_id)!==targetId||Number(latest?.id)!==pipelineId||Number(latest?.project_id)!==projectId||latest?.sha!==pipeline.sha||latest?.ref!==pipeline.ref||latest?.status!==pipeline.status)throw unbound('GitLab MR or head pipeline changed during readiness checks.');
  if(targetHead&&await this.getTargetBranchSha(mr.target_branch)!==targetHead)throw unbound('GitLab target moved during merged-results readiness checks.');
  return checks;
 }
 async listExternalStatusChecks(iid){const r=await this.client.request('GET',this.path(`/merge_requests/${iid}/status_checks`),{expected:[200,403,404]});if(r.status!==200||!Array.isArray(r.data))return[];return r.data.map(c=>({name:c.name||`external:${c.id}`,state:externalState(c.status),url:c.external_url||'',externalStatusCheckId:c.id}));}
 async listApprovals(iid){const r=await this.client.request('GET',this.path(`/merge_requests/${iid}/approvals`),{expected:[200,403,404]});return r.status===200?(r.data?.approved_by||[]).map(x=>x.user?.username).filter(Boolean):[];} async getApprovalState(iid){const r=await this.client.request('GET',this.path(`/merge_requests/${iid}/approval_state`),{expected:[200,403,404]});return r.status===200?r.data:null;}
 async getMergePolicySnapshot(){return{status:'available',requiredChecks:[],requiredApprovals:0,requireCodeOwners:false,requireThreadResolution:false,mergeQueue:false,allowedMergeMethods:[]};}
 async resolveUsers(names){const out=[];for(const username of unique(names)){const r=await this.client.request('GET','/users',{query:{username}});const exact=(r.data||[]).find(u=>u.username===username);if(exact)out.push(exact);}return out;}
 async requestReviewers(iid,routing){const users=await this.resolveUsers(routing?.users||[]),current=await this.getChangeRequest(iid);const existing=Array.isArray(current?.reviewers)?current.reviewers.map(u=>u.id).filter(Boolean):[];if(users.length)await this.client.request('PUT',this.path(`/merge_requests/${iid}`),{body:{reviewer_ids:unique([...existing,...users.map(u=>u.id)])}});return{unresolvedTeams:unique(routing?.teams||[])};}
 async addLabels(iid,labels){if(!labels.length)return null;return(await this.client.request('PUT',this.path(`/merge_requests/${iid}`),{body:{add_labels:unique(labels).join(',')}})).data;}
 classifyMergeState(fresh){const s=String(fresh.mergeState||'unknown').toLowerCase();if(s==='mergeable'||s==='can_be_merged')return{status:'ready',code:'mergeable',message:'GitLab reports mergeable.'};if(BLOCKED.has(s))return{status:'blocked',code:`gitlab_${s}`,message:`GitLab merge state blocks merge: ${s}.`};if(WAITING.has(s))return{status:'waiting',code:'merge_state_pending',message:`GitLab mergeability is waiting: ${s}.`};return{status:'waiting',code:'merge_state_unknown',message:`Unknown GitLab detailed_merge_status ${s}; fail closed.`};}
 async markReady(change){const title=String(change.title||'').replace(/^\s*(draft:|wip:)\s*/i,'');return this.updateChangeRequest(change.iid,{title,body:change.description||''});}
 async enableAutoMerge(change){const sha=confirmedHeadOid(change);const cap=await this.validateCompatibility();const body={sha};body[cap.autoMergeParameter]=true;return(await this.client.request('PUT',this.path(`/merge_requests/${change.iid}/merge`),{body,expected:[200,201,202]})).data;}
 async enqueueMergeTrain(change){const sha=confirmedHeadOid(change);const cap=await this.validateCompatibility();const body={sha};if(versionAtLeast(cap.version,'17.11.0'))body.auto_merge=true;else body.when_pipeline_succeeds=true;return(await this.client.request('POST',this.path(`/merge_trains/merge_requests/${change.iid}`),{body,expected:[201,202,403,404]})).data;}
 openUrl(c){return c.web_url;} normalize(c){return{provider:'gitlab',number:c.iid,id:c.id,title:c.title,body:c.description||'',url:c.web_url,draft:Boolean(c.draft??c.work_in_progress??/^\s*(draft:|wip:)/i.test(c.title||'')),state:c.state,headSha:c.sha||c.diff_refs?.head_sha||'',sourceBranch:c.source_branch||'',targetBranch:c.target_branch||'',conflicts:Boolean(c.has_conflicts),mergeState:c.detailed_merge_status||c.merge_status||'unknown',blockingDiscussionsResolved:c.blocking_discussions_resolved,raw:c};}
}
module.exports={GitLabProvider,enc,checkState,jobCheckState,externalState,parseVersion,versionAtLeast,WAITING,BLOCKED};
