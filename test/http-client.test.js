'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { nextPage } = require('../src/http-client');
function headers(values){ return {get:k=>values[k.toLowerCase()]||''}; }
test('pagination follows X-Next-Page and Link',()=>{ assert.equal(nextPage(headers({'x-next-page':'3'}),2),3); assert.equal(nextPage(headers({link:'<https://api.example/items?page=4>; rel="next"'}),3),4); assert.equal(nextPage(headers({}),1),0); });
