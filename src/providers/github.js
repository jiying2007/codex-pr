'use strict';
const { HttpClient } = require('../http-client');
const { unique } = require('../util');

const API_VERSION_HEADERS = { 'X-GitHub-Api-Version': '2026-03-10' };

function statusState(value) {
  if (value === 'success') return 'success';
  if (value === 'pending') return 'pending';
  return 'failure';
}
function checkRunState(run) {
  if (run?.status !== 'completed') return 'pending';
  return ['success', 'neutral', 'skipped'].includes(run?.conclusion) ? 'success' : 'failure';
}
function requiredChecksFromRules(rules) {
  const names = [];
  for (const rule of rules || []) {
    if (rule?.type !== 'required_status_checks') continue;
    for (const check of rule?.parameters?.required_status_checks || []) if (check?.context) names.push(check.context);
  }
  return unique(names);
}

class GitHubProvider {
  constructor({ remote, apiBaseUrl, token, timeoutMs, allowInsecureHttp }) {
    this.kind = 'github';
    this.remote = remote;
    this.repo = remote.projectPath;
    this.apiHeaders = remote.host === 'github.com' ? API_VERSION_HEADERS : {};
    this.hasToken = Boolean(token);
    this.client = new HttpClient({
      baseUrl: apiBaseUrl,
      token,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer ',
      timeoutMs,
      allowInsecureHttp,
      userAgent: 'codex-change-safe/5 github'
    });
  }
  path(suffix = '') { return `/repos/${this.repo}${suffix}`; }
  async getBranchSha(branch) {
    const r = await this.client.request('GET', this.path(`/branches/${encodeURIComponent(branch)}`), { headers: this.apiHeaders });
    return r.data?.commit?.sha || '';
  }
  async findOpenChangeRequest(sourceBranch, targetBranch) {
    const owner = this.remote.owner;
    const result = await this.client.paginate(this.path('/pulls'), { state: 'open', head: `${owner}:${sourceBranch}`, base: targetBranch }, { headers: this.apiHeaders });
    if (!result.complete) throw Object.assign(new Error('Could not exhaustively scan open pull requests.'), { code: 'ESCMPAGINATION' });
    return result.items[0] || null;
  }
  async createChangeRequest({ sourceBranch, targetBranch, title, body, draft }) {
    return (await this.client.request('POST', this.path('/pulls'), {
      body: { head: sourceBranch, base: targetBranch, title, body, draft: Boolean(draft) },
      expected: [201],
      headers: this.apiHeaders
    })).data;
  }
  async updateChangeRequest(number, { title, body }) {
    return (await this.client.request('PATCH', this.path(`/pulls/${number}`), { body: { title, body }, headers: this.apiHeaders })).data;
  }
  async getChangeRequest(number) {
    return (await this.client.request('GET', this.path(`/pulls/${number}`), { headers: this.apiHeaders })).data;
  }
  async listChecks(sha) {
    const [statuses, runs] = await Promise.all([
      this.client.paginate(this.path(`/commits/${sha}/statuses`), {}, { headers: this.apiHeaders }),
      this.client.paginateCollection(this.path(`/commits/${sha}/check-runs`), 'check_runs', {}, { headers: this.apiHeaders }).catch(() => ({ items: [], complete: true }))
    ]);
    if (!statuses.complete || !runs.complete) throw Object.assign(new Error('Could not exhaustively scan GitHub checks.'), { code: 'ESCMPAGINATION' });
    const out = [];
    for (const s of statuses.items || []) out.push({ name: s.context, state: statusState(s.state), url: s.target_url || '' });
    for (const r of runs.items || []) out.push({ name: r.name, state: checkRunState(r), url: r.html_url || '' });
    const dedup = new Map();
    for (const item of out) if (!dedup.has(item.name)) dedup.set(item.name, item);
    return [...dedup.values()];
  }
  async getRequiredCheckNames(targetBranch) {
    const branch = encodeURIComponent(targetBranch);
    const classic = await this.client.request('GET', this.path(`/branches/${branch}/protection/required_status_checks`), {
      expected: [200, 403, 404], headers: this.apiHeaders
    });
    const rulesProbe = await this.client.request('GET', this.path(`/rules/branches/${branch}`), {
      query: { per_page: 100, page: 1 }, expected: [200, 403, 404], headers: this.apiHeaders
    });

    let rules = [];
    if (rulesProbe.status === 200) {
      const paged = await this.client.paginate(this.path(`/rules/branches/${branch}`), {}, { headers: this.apiHeaders });
      if (!paged.complete) throw Object.assign(new Error('Could not exhaustively scan active GitHub branch rules.'), { code: 'ESCMPAGINATION' });
      rules = paged.items;
    }

    const classicNames = classic.status === 200
      ? unique([
          ...(Array.isArray(classic.data?.contexts) ? classic.data.contexts : []),
          ...(Array.isArray(classic.data?.checks) ? classic.data.checks.map(x => x.context).filter(Boolean) : [])
        ])
      : [];
    const rulesetNames = requiredChecksFromRules(rules);
    const names = unique([...classicNames, ...rulesetNames]);

    if (classic.status === 403 || rulesProbe.status === 403) return { status: 'unknown', names };
    return { status: names.length ? 'available' : 'none', names };
  }
  async listApprovals(number) {
    const result = await this.client.paginate(this.path(`/pulls/${number}/reviews`), {}, { headers: this.apiHeaders });
    if (!result.complete) throw Object.assign(new Error('Could not exhaustively scan pull request reviews.'), { code: 'ESCMPAGINATION' });
    const latest = new Map();
    for (const review of result.items || []) if (review.user?.login && review.state !== 'PENDING') latest.set(review.user.login, review.state);
    return [...latest.entries()].filter(([, state]) => state === 'APPROVED').map(([username]) => username);
  }
  async requestReviewers(number, reviewers) {
    if (!reviewers.length) return null;
    return (await this.client.request('POST', this.path(`/pulls/${number}/requested_reviewers`), {
      body: { reviewers: unique(reviewers) }, expected: [201], headers: this.apiHeaders
    })).data;
  }
  async addLabels(number, labels) {
    if (!labels.length) return null;
    return (await this.client.request('POST', this.path(`/issues/${number}/labels`), { body: { labels: unique(labels) }, headers: this.apiHeaders })).data;
  }
  async graphql(query, variables) {
    let base = this.client.baseUrl;
    if (base.endsWith('/api/v3')) base = base.slice(0, -7) + '/api/graphql';
    else if (new URL(base).hostname === 'api.github.com') base = 'https://api.github.com/graphql';
    else base = `${base.replace(/\/$/, '')}/graphql`;
    const parsed = new URL(base);
    const client = new HttpClient({
      baseUrl: parsed.origin,
      token: this.client.token,
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer ',
      timeoutMs: this.client.timeoutMs,
      allowInsecureHttp: parsed.protocol === 'http:',
      userAgent: 'codex-change-safe/5 github-graphql'
    });
    const r = await client.request('POST', parsed.pathname, { body: { query, variables } });
    if (r.data?.errors?.length) {
      const error = new Error(`GitHub GraphQL: ${r.data.errors[0].message}`);
      error.code = 'EGITHUBGRAPHQL'; error.details = r.data.errors; throw error;
    }
    return r.data?.data;
  }
  async markReady(change) {
    const data = await this.graphql('mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id isDraft}}}', { id: change.node_id });
    return data?.markPullRequestReadyForReview?.pullRequest;
  }
  async enableAutoMerge(change, mergeMethod = 'SQUASH') {
    const data = await this.graphql('mutation($id:ID!,$method:PullRequestMergeMethod!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:$method}){pullRequest{id autoMergeRequest{enabledAt}}}}', { id: change.node_id, method: mergeMethod });
    return data?.enablePullRequestAutoMerge?.pullRequest;
  }
  async enqueueMergeQueue(change) {
    const data = await this.graphql('mutation($id:ID!){enqueuePullRequest(input:{pullRequestId:$id}){mergeQueueEntry{id position}}}', { id: change.node_id });
    return data?.enqueuePullRequest?.mergeQueueEntry;
  }
  openUrl(change) { return change.html_url; }
  normalize(change) {
    return {
      provider: 'github', number: change.number, id: change.id, nodeId: change.node_id,
      title: change.title, body: change.body || '', url: change.html_url, draft: Boolean(change.draft),
      state: change.state, headSha: change.head?.sha || '', sourceBranch: change.head?.ref || '',
      targetBranch: change.base?.ref || '', conflicts: change.mergeable === false,
      mergeState: change.mergeable_state || 'unknown', raw: change
    };
  }
}
module.exports = { GitHubProvider, statusState, checkRunState, requiredChecksFromRules };
