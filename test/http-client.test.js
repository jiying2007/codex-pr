'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { HttpClient, nextPage } = require('../src/http-client');
function headers(values){ return {get:k=>values[k.toLowerCase()]||''}; }
test('pagination follows X-Next-Page and Link',()=>{ assert.equal(nextPage(headers({'x-next-page':'3'}),2),3); assert.equal(nextPage(headers({link:'<https://api.example/items?page=4>; rel="next"'}),3),4); assert.equal(nextPage(headers({}),1),0); });
test('SCM requests refuse automatic redirects so credentials cannot cross an unvalidated hop', async()=>{ const original=global.fetch; let options; global.fetch=async(_url,init)=>{ options=init; return {status:200,headers:headers({}),text:async()=>'{"ok":true}'}; }; try { const client=new HttpClient({baseUrl:'https://gitlab.local/api/v4',token:'secret',tokenHeader:'PRIVATE-TOKEN'}); await client.request('GET','/version'); assert.equal(options.redirect,'error'); assert.equal(options.headers['PRIVATE-TOKEN'],'secret'); } finally { global.fetch=original; } });
