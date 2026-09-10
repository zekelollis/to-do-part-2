import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,applyAction,parseWho,normalize,shuffleCandidates,mine,DAY,dueAt} from '../src/model.js';
const add=(s,id,title=id,kind='do')=>applyAction(s,{type:'add',id,title,kind},1000).state;
test('ordinary capture preserves mentions and email addresses',()=>{
 const s=add(emptyState(),'a','Email jane@example.com and @Alex');
 assert.equal(s.tasks[0].title,'Email jane@example.com and @Alex');
 assert.deepEqual(parseWho('Email jane@example.com'),{title:'Email jane@example.com',who:''});
 assert.deepEqual(parseWho('Get the report @Alex'),{title:'Get the report',who:'Alex'});
});
test('completion advances the deck; dropping and restoring retain notes',()=>{
 let s=add(add(add(emptyState(),'a'),'b'),'c');
 s=applyAction(s,{type:'deck',id:'c'}).state;
 s=applyAction(s,{type:'done',id:'a'},2000).state;
 assert.equal(s.nowId,'c');assert.equal(s.tasks[0].completedAt,2000);assert.deepEqual(s.deck,[]);
 s=applyAction(s,{type:'edit',id:'c',title:'C',who:'',details:['Keep this'],checkDays:2}).state;
 s=applyAction(s,{type:'drop',id:'c'}).state;
 assert.equal(s.nowId,'b');assert.equal(mine(s).length,1);
 s=applyAction(s,{type:'restore',id:'c'}).state;
 assert.deepEqual(s.tasks.find(t=>t.id==='c').details,['Keep this']);
});
test('handoff clears attention slots and ownership can be removed',()=>{
 let s=add(add(emptyState(),'a'),'b');
 s=applyAction(s,{type:'flag',id:'b'}).state;s=applyAction(s,{type:'deck',id:'b'}).state;
 s=applyAction(s,{type:'handoff',id:'b'}).state;
 assert.deepEqual(s.deck,[]);assert.deepEqual(s.flagged,[]);
 s=applyAction(s,{type:'edit',id:'b',title:'Report',who:'Alex',details:[],checkDays:1}).state;
 s=applyAction(s,{type:'edit',id:'b',title:'Report',who:'',details:[],checkDays:1}).state;
 assert.equal(s.tasks[1].who,'');
});
test('shuffle winner follows this round, regardless of historical weight',()=>{
 let s=add(add(emptyState(),'a'),'b');s.tasks[0].weight=200;
 s=applyAction(s,{type:'shuffleChoice',ids:['a','b'],id:'b',final:true},2000).state;
 assert.equal(s.nowId,'b');assert.equal(s.tasks[0].lastComparedAt,2000);
});
test('every task is sampled across successive rounds',()=>{
 let s=emptyState();for(let i=0;i<20;i++)s=add(s,String(i));
 const seen=new Set();
 for(let r=0;r<5;r++){
  const candidates=shuffleCandidates(s);candidates.forEach(t=>seen.add(t.id));
  for(let i=1;i<candidates.length;i++)s=applyAction(s,{type:'shuffleChoice',ids:[candidates[0].id,candidates[i].id],id:candidates[0].id,final:i===candidates.length-1},2000+r).state;
 }
 assert.equal(seen.size,20);
});
test('skip never chooses the same task when another is available',()=>{
 let s=add(add(emptyState(),'a'),'b');s.tasks[0].weight=1000;
 s=applyAction(s,{type:'skip',id:'a'}).state;assert.equal(s.nowId,'b');
});
test('deck displacement is explicit, capped, and keeps task',()=>{
 let s=emptyState();for(let i=0;i<4;i++)s=add(s,String(i));
 for(const id of ['1','2'])s=applyAction(s,{type:'deck',id}).state;
 const result=applyAction(s,{type:'deck',id:'3'});
 assert.deepEqual(result.state.deck,['2','3']);assert.match(result.message,/returned to the pile/);assert.equal(result.state.tasks.length,4);
});
test('backup validation rejects invalid records without changing state',()=>{
 assert.throws(()=>normalize({v:3,tasks:[{id:'a',title:'A',kind:'do',details:[{}]}]}));
 assert.throws(()=>normalize({v:100,tasks:[]}));
 const s=add(emptyState(),'a');assert.throws(()=>applyAction(s,{type:'import',state:{v:3,tasks:[{}]}}));assert.equal(s.tasks.length,1);
});
test('import merges without replacing existing tasks and preserves deck on fresh device',()=>{
 let incoming=add(add(emptyState(),'a'),'b');incoming=applyAction(incoming,{type:'deck',id:'b'}).state;
 const fresh=applyAction(emptyState(),{type:'import',state:incoming}).state;assert.deepEqual(fresh.deck,['b']);
 const existing=add(emptyState(),'a','Local title');const merged=applyAction(existing,{type:'import',state:incoming}).state;
 assert.equal(merged.tasks.length,2);assert.equal(merged.tasks[0].title,'Local title');
});
test('editing guards against another tab changing the same task',()=>{
 const s=add(emptyState(),'a');const seed=JSON.stringify(s.tasks[0]);
 const changed=applyAction(s,{type:'edit',id:'a',title:'Other tab',who:'',details:[],checkDays:2}).state;
 assert.throws(()=>applyAction(changed,{type:'edit',id:'a',expectedTask:seed,title:'Stale title',who:'',details:[],checkDays:2}),/another tab/);
});
test('follow-ups sort by due time rather than delegation age',()=>{
 const slow={since:1000,checkDays:7};const urgent={since:1000+4*DAY,checkDays:1};assert.ok(dueAt(urgent)<dueAt(slow));
});
