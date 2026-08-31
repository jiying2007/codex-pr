'use strict';
const { assertSafeUrl } = require('./util');

function nextPage(headers, currentPage) {
  const x = String(headers.get('x-next-page') || '').trim();
  if (/^\d+$/.test(x) && Number(x) > currentPage) return Number(x);
  const link = String(headers.get('link') || '');
  for (const part of link.split(',')) {
    if (!/;\s*rel="?next"?/i.test(part)) continue;
    const match = part.match(/<([^>]+)>/); if (!match) continue;
    try { const n = Number(new URL(match[1]).searchParams.get('page')); if (Number.isInteger(n) && n > currentPage) return n; } catch {}
  }
  return 0;
}
class HttpClient {
  constructor({ baseUrl, token, tokenHeader, tokenPrefix = '', timeoutMs = 30000, allowInsecureHttp = false, userAgent = 'codex-change-safe/5' }) {
    const url = assertSafeUrl(baseUrl, allowInsecureHttp);
    this.baseUrl = url.toString().replace(/\/$/, ''); this.token = token || ''; this.tokenHeader = tokenHeader; this.tokenPrefix = tokenPrefix; this.timeoutMs = timeoutMs; this.userAgent = userAgent; this.allowInsecureHttp = allowInsecureHttp;
  }
  async request(method, pathname, { query, body, expected = [200], headers = {} } = {}) {
    const url = new URL(`${this.baseUrl}${pathname}`);
    if (query) for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) value.forEach(v => url.searchParams.append(key, String(v))); else url.searchParams.set(key, String(value));
    }
    const requestHeaders = { Accept: 'application/json', 'User-Agent': this.userAgent, ...headers };
    if (this.token && this.tokenHeader) requestHeaders[this.tokenHeader] = `${this.tokenPrefix}${this.token}`;
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    let response;
    try { response = await fetch(url, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) }); }
    catch (cause) { const error = new Error(`SCM ${method} ${url.origin}${url.pathname} network failure`); error.code = 'ESCMNETWORK'; error.cause = cause; throw error; }
    const text = await response.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!expected.includes(response.status)) { const error = new Error(`SCM ${method} ${url.pathname} failed with ${response.status}`); error.code = 'ESCMHTTP'; error.status = response.status; error.responseBody = typeof data === 'string' ? data.slice(0, 2000) : data; throw error; }
    return { data, status: response.status, headers: response.headers };
  }
  async paginate(pathname, query = {}, { maxPages = 20, headers = {}, expected = [200] } = {}) {
    const items = []; let page = 1;
    while (page <= maxPages) {
      const response = await this.request('GET', pathname, { query: { ...query, per_page: 100, page }, headers, expected });
      if (!Array.isArray(response.data)) { const error = new Error(`SCM pagination at ${pathname} did not return an array`); error.code = 'ESCMPAGINATION'; throw error; }
      items.push(...response.data); const next = nextPage(response.headers, page); if (!next) return { items, complete: true }; page = next;
    }
    return { items, complete: false };
  }
  async paginateCollection(pathname, key, query = {}, { maxPages = 20, headers = {}, expected = [200] } = {}) {
    const items = []; let page = 1;
    while (page <= maxPages) {
      const response = await this.request('GET', pathname, { query: { ...query, per_page: 100, page }, headers, expected });
      const pageItems = response.data?.[key];
      if (!Array.isArray(pageItems)) { const error = new Error(`SCM pagination at ${pathname} did not return collection ${key}`); error.code = 'ESCMPAGINATION'; throw error; }
      items.push(...pageItems); const next = nextPage(response.headers, page); if (!next) return { items, complete: true }; page = next;
    }
    return { items, complete: false };
  }
}
module.exports = { HttpClient, nextPage };
