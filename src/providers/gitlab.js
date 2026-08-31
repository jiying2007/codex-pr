'use strict';
const { HttpClient } = require('../http-client');
const { unique } = require('../util');
function enc(v) { return encodeURIComponent(String(v)); }
function parseVersion(value) { const m=String(value||'').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? m.slice(1).map(Number) : null; }
function versionAtLeast(value, minimum) { const a=parseVersion(value), b=parseVersion(minimum); if(!a||!b) return false; for(let i=0;i<3;i++){ if(a[i]>b[i]) return true; if(a[i]<b[i]) return false; } return true; }
function checkState(status, allowFailure = false) {
  const normalized = String(status || '').toLowerCase();
  if (['success', 'skipped'].includes(normalized)) return 'success';
  if (normalized === 'manual') return allowFailure ? 'success' : 'pending';
  if (['failed', 'canceled', 'canceling'].includes(normalized)) return allowFailure ? 'success' : 'failure';
  if (['running', 'pending', 'created', 'preparing', 'waiting_for_resource', 'waiting_for_callback', 'scheduled'].includes(normalized)) return 'pending';
  return 'failure';
}
function jobCheckState(job) { return checkState(job?.status, job?.allow_failure === true); }

class GitLabProvider {
  constructor({ remote, apiBaseUrl, token, timeoutMs, allowInsecureHttp }) {
    this.kind = 'gitlab'; this.remote = remote; this.project = remote.projectPath; this.hasToken = Boolean(token);
    this.client = new HttpClient({ baseUrl: apiBaseUrl, token, tokenHeader: 'PRIVATE-TOKEN', timeoutMs, allowInsecureHttp, userAgent: 'codex-change-safe/5 gitlab' });
  }
  path(suffix = '') { return `/projects/${enc(this.project)}${suffix}`; }
  async getVersion() { if (this.versionInfo) return this.versionInfo; this.versionInfo = (await this.client.request('GET', '/version')).data; return this.versionInfo; }
  async validateCompatibility() { const info=await this.getVersion(); const version=String(info?.version||''); if(!parseVersion(version)) throw Object.assign(new Error('GitLab version could not be determined safely.'),{code:'EGITLABVERSION'}); if(!versionAtLeast(version,'14.6.1')) throw Object.assign(new Error(`GitLab ${version} is below the supported minimum 14.6.1.`),{code:'EGITLABVERSION'}); return { version, autoMergeParameter: versionAtLeast(version,'17.11.0') ? 'auto_merge' : 'merge_when_pipeline_succeeds' }; }
  async getBranchSha(branch) { const r = await this.client.request('GET', this.path(`/repository/branches/${enc(branch)}`)); return r.data?.commit?.id || ''; }
  async findOpenChangeRequest(sourceBranch, targetBranch) {
    const result = await this.client.paginate(this.path('/merge_requests'), { state: 'opened', source_branch: sourceBranch, target_branch: targetBranch, scope: 'all' });
    if (!result.complete) throw Object.assign(new Error('Could not exhaustively scan open merge requests.'), { code: 'ESCMPAGINATION' });
    return result.items[0] || null;
  }
  async createChangeRequest({ sourceBranch, targetBranch, title, body, draft }) {
    const effectiveTitle = draft && !/^\s*(draft:|wip:)/i.test(title) ? `Draft: ${title}` : title;
    return (await this.client.request('POST', this.path('/merge_requests'), { body: { source_branch: sourceBranch, target_branch: targetBranch, title: effectiveTitle, description: body, allow_collaboration: true }, expected: [201] })).data;
  }
  async updateChangeRequest(iid, { title, body }) { return (await this.client.request('PUT', this.path(`/merge_requests/${iid}`), { body: { title, description: body } })).data; }
  async getChangeRequest(iid) { return (await this.client.request('GET', this.path(`/merge_requests/${iid}`), { query: { include_diverged_commits_count: true } })).data; }
  async listPipelines(iid) { const result = await this.client.paginate(this.path(`/merge_requests/${iid}/pipelines`)); if (!result.complete) throw Object.assign(new Error('Could not exhaustively scan merge request pipelines.'), { code: 'ESCMPAGINATION' }); return result.items; }
  async listChecks(iid) {
    const mr = await this.getChangeRequest(iid);
    let pipeline = mr?.head_pipeline || null;
    if (!pipeline) pipeline = (await this.listPipelines(iid))[0] || null;
    if (!pipeline?.id) return [];
    const probe = await this.client.request('GET', this.path(`/pipelines/${pipeline.id}/jobs`), { query: { per_page: 100, page: 1, include_retried: false }, expected: [200, 403, 404] });
    if (probe.status === 200) {
      const paged = await this.client.paginate(this.path(`/pipelines/${pipeline.id}/jobs`), { include_retried: false });
      if (!paged.complete) throw Object.assign(new Error('Could not exhaustively scan pipeline jobs.'), { code: 'ESCMPAGINATION' });
      if (paged.items.length) return paged.items.map(job => ({ name: job.name, state: jobCheckState(job), url: job.web_url || '', pipelineId: pipeline.id, jobId: job.id, allowFailure: job.allow_failure === true }));
    }
    return [{ name: `pipeline:${pipeline.id}`, state: checkState(pipeline.status), url: pipeline.web_url || '', pipelineId: pipeline.id }];
  }
  async listApprovals(iid) {
    const r = await this.client.request('GET', this.path(`/merge_requests/${iid}/approvals`), { expected: [200, 403, 404] });
    if (r.status !== 200) return [];
    return (r.data?.approved_by || []).map(x => x.user?.username).filter(Boolean);
  }
  async getApprovalState(iid) {
    const r = await this.client.request('GET', this.path(`/merge_requests/${iid}/approval_state`), { expected: [200, 403, 404] });
    return r.status === 200 ? r.data : null;
  }
  async resolveUsers(usernames) {
    const out = [];
    for (const username of unique(usernames)) {
      const r = await this.client.request('GET', '/users', { query: { username } }); const exact = (r.data || []).find(u => u.username === username); if (exact) out.push(exact);
    }
    return out;
  }
  async requestReviewers(iid, reviewers) {
    if (!reviewers.length) return null; const [users, current] = await Promise.all([this.resolveUsers(reviewers), this.getChangeRequest(iid)]); if (!users.length) return null;
    const existing = Array.isArray(current?.reviewers) ? current.reviewers.map(u => u.id).filter(Boolean) : [];
    return (await this.client.request('PUT', this.path(`/merge_requests/${iid}`), { body: { reviewer_ids: unique([...existing, ...users.map(u => u.id)]) } })).data;
  }
  async addLabels(iid, labels) { if (!labels.length) return null; return (await this.client.request('PUT', this.path(`/merge_requests/${iid}`), { body: { add_labels: unique(labels).join(',') } })).data; }
  async markReady(change) { const title = String(change.title || '').replace(/^\s*(draft:|wip:)\s*/i, ''); return this.updateChangeRequest(change.iid, { title, body: change.description || '' }); }
  async enableAutoMerge(change) { const capability=await this.validateCompatibility(); const body={ sha: change.sha }; body[capability.autoMergeParameter]=true; return (await this.client.request('PUT', this.path(`/merge_requests/${change.iid}/merge`), { body, expected: [200, 201, 202] })).data; }
  openUrl(change) { return change.web_url; }
  normalize(change) { return { provider: 'gitlab', number: change.iid, id: change.id, title: change.title, body: change.description || '', url: change.web_url, draft: Boolean(change.draft ?? change.work_in_progress ?? /^\s*(draft:|wip:)/i.test(change.title || '')), state: change.state, headSha: change.sha || change.diff_refs?.head_sha || '', sourceBranch: change.source_branch || '', targetBranch: change.target_branch || '', conflicts: Boolean(change.has_conflicts), mergeState: change.detailed_merge_status || change.merge_status || 'unknown', blockingDiscussionsResolved: change.blocking_discussions_resolved, raw: change }; }
}
module.exports = { GitLabProvider, enc, checkState, jobCheckState, parseVersion, versionAtLeast };
