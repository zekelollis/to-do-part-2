import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,applyAction,normalize,dayKey,todayTasks,inboxTasks,followupReady,reviewReady,shuffleCandidates} from '../src/model.js';
import {validateAction} from '../server/core.js';
const morning=Date.parse('2026-09-28T08:00:00-04:00');
const tomorrow=Date.parse('2026-09-29T08:00:00-04:00');
const run=(s,a,now=morning)=>applyAction(s,a,now).state;
const add=(s,id,destination='inbox')=>run(s,{type:'add',id,title:id,kind:'do',destination});

test('capture stays out of Focus until deliberately planned',()=>{
 let s=add(emptyState(),'first');s=add(s,'second');
 assert.equal(s.nowId,null);assert.equal(inboxTasks(s).length,2);assert.equal(todayTasks(s,morning).length,0);
 s=run(s,{type:'plan',id:'first',destination:'today'});
 assert.equal(s.nowId,'first');assert.equal(inboxTasks(s).length,1);
 s=add(s,'new email');assert.equal(s.nowId,'first');
 s=run(s,{type:'done',id:'first'});assert.equal(s.nowId,null);assert.equal(inboxTasks(s).length,2);
});
test('old desk migration retains IDs, links, notes, flags and selected work',()=>{
 const legacy={v:3,revision:7,tasks:['a','b','c'].map(id=>({id,title:id,kind:'do',details:['note'],claimUrl:'https://example.sharepoint.com/claims'})),nowId:'a',deck:['b'],flagged:['c']};
 const s=normalize(legacy,morning);
 assert.deepEqual(todayTasks(s,morning).map(t=>t.id),['a','b']);assert.equal(s.tasks[2].inbox,false);
 assert.equal(s.tasks[0].claimUrl,legacy.tasks[0].claimUrl);assert.deepEqual(s.flagged,['c']);assert.equal(s.revision,7);
 assert.deepEqual(normalize(s,morning),s);
});
test('midnight clears the working view but keeps unfinished work and dates',()=>{
 let s=add(add(emptyState(),'a','today'),'b','today');s=run(s,{type:'deck',id:'b'});
 const next=normalize(s,tomorrow);assert.equal(next.nowId,null);assert.deepEqual(next.deck,[]);assert.equal(next.tasks.length,2);
 assert.equal(todayTasks(next,tomorrow).length,0);assert.ok(next.tasks.every(t=>t.planDate<dayKey(tomorrow)));
 assert.deepEqual(normalize(next,tomorrow+1),next);
 s=run(next,{type:'plan',id:'b',destination:'today'},tomorrow);assert.equal(s.nowId,'b');
});
test('scheduled reviews resurface without becoming Today automatically',()=>{
 let s=add(emptyState(),'a');s=run(s,{type:'plan',id:'a',destination:'later',reviewDate:'2026-09-29'});
 assert.equal(inboxTasks(s).length,0);assert.equal(reviewReady(s.tasks[0],morning),false);assert.equal(reviewReady(s.tasks[0],tomorrow),true);
 assert.equal(todayTasks(s,tomorrow).length,0);assert.equal(normalize(s,tomorrow).nowId,null);
 s=run(s,{type:'plan',id:'a',destination:'today'},tomorrow);assert.equal(s.tasks[0].reviewDate,'');
});
test('nested interruptions resume in order with notes; stale switches are rejected',()=>{
 let s=add(add(add(emptyState(),'a','today'),'b'),'c');
 s=run(s,{type:'interrupt',id:'b',expectedNowId:'a',resumeNote:'Continue the draft'});
 s=run(s,{type:'interrupt',id:'c',expectedNowId:'b',resumeNote:'Finish call'});
 assert.deepEqual(s.resumeIds,['b','a']);
 assert.throws(()=>run(s,{type:'interrupt',id:'a',expectedNowId:'b'}),/focus changed/);
 s=run(s,{type:'done',id:'c'});assert.equal(s.nowId,'b');
 s=run(s,{type:'handoff',id:'b',reviewDate:'2026-09-30'});assert.equal(s.nowId,'a');assert.equal(s.tasks[0].resumeNote,'Continue the draft');
});
test('explicit follow-up dates start on the chosen Eastern day including DST',()=>{
 const t={kind:'wait',reviewDate:'2026-11-01'};
 assert.equal(followupReady(t,Date.parse('2026-11-01T03:59:00Z')),false);
 assert.equal(followupReady(t,Date.parse('2026-11-01T04:00:00Z')),true);
 assert.equal(followupReady(t,Date.parse('2026-11-02T04:00:00Z')),true);
});
test('API validates planning inputs and backup imports reject invalid dates',()=>{
 for(const reviewDate of ['2026-02-30','bad',{}])assert.throws(()=>validateAction({type:'plan',id:'a',destination:'later',reviewDate}));
 assert.throws(()=>validateAction({type:'plan',id:'a',destination:'surprise'}));
 assert.throws(()=>validateAction({type:'interrupt',id:'a',resumeNote:'x'.repeat(501),expectedNowId:null}));
 const s=add(emptyState(),'a');s.tasks[0].reviewDate='2026-02-30';assert.throws(()=>normalize(s));
});
test('shuffle excludes inbox and future tasks',()=>{
 let s=emptyState();const now=Date.now();
 for(const [id,destination] of [['a','today'],['b','today'],['c','inbox']])s=run(s,{type:'add',id,title:id,kind:'do',destination},now);
 assert.deepEqual(new Set(shuffleCandidates(s).map(t=>t.id)),new Set(['a','b']));
});
