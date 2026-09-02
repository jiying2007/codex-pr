'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const{parseNameStatusZ,safeToken}=require('../src/git-cli');
test('name-status parser is NUL safe for tabs newlines renames and copies',()=>{const data=['M','a\tb.js','R100','old\nname.c','new\nname.c','C90','a.c','b.c'].join('\0')+'\0';assert.deepEqual(parseNameStatusZ(data),[{status:'M',path:'a\tb.js'},{status:'R',path:'new\nname.c',oldPath:'old\nname.c'},{status:'C',path:'b.c',oldPath:'a.c'}]);});
test('git tokens reject option injection and controls',()=>{assert.throws(()=>safeToken('--help','ref'),{code:'EGITTOKEN'});assert.throws(()=>safeToken('main\n--evil','ref'),{code:'EGITTOKEN'});});
