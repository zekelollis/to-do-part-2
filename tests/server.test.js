import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import sessionHandler from '../api/session.js';
import tasksHandler from '../api/tasks.js';
import {CAS_SCRIPT,RATE_SCRIPT,SESSION_SECONDS} from '../server/core.js';
// Contract-level Redis REST double. Live Upstash/Vercel verification requires deployment credentials.
let records,expires,clockOffset=0;
const time=()=>Date.now()+clockOffset;
const get=key=>{if(expires.has(key)&&expires.get(key)<=time()){records.delete(key);expires.delete(key);}return records.get(key)??null;};
const set=(key,value,seconds)=>{records.set(key,value);if(seconds)expires.set(key,time()+seconds*1000);else expires.delete(key);return 'OK';};
const run=([command,...args])=>{
 if(command==='GET')return get(args[0]);
 if(command==='SET')return set(args[0],args[1],args[2]==='EX'?Number(args[3]):undefined);
 if(command==='DEL'){const had=records.delete(args[0]);expires.delete(args[0]);return had?1:0;}
 if(command==='EVAL'&&args[0]===RATE_SCRIPT){const key=args[2],n=Number(get(key)||0)+1;records.set(key,n);if(n===1)expires.set(key,time()+900000);return n;}
 if(command==='EVAL'&&args[0]===CAS_SCRIPT){const [,count,stateKey,opKey,revision,state,result]=args;assert.equal(count,2);const cache=get(opKey);if(cache)return ['cached',cache];const current=get(stateKey);if(Number(revision)!==Number(current?JSON.parse(current).revision:0))return ['conflict',''];set(stateKey,state);set(opKey,result,86400);return ['ok',result];}
 throw Error('Unexpected Redis command');
};
beforeEach(()=>{
 records=new Map();expires=new Map();clockOffset=0;
 process.env.TODO_PASSWORD='test-only-long-passphrase';process.env.UPSTASH_REDIS_REST_URL='https://redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';process.env.NODE_ENV='production';
 delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://redis.test');assert.equal(options.headers.Authorization,'Bearer test-token');return {ok:true,json:async()=>({result:run(JSON.parse(options.body))})};};
});
async function call(handler,{method='GET',data,cookie,origin='https://todo.test',ip='192.0.2.1'}={}){
 const headers={host:'todo.test',origin,'content-type':'application/json','x-vercel-forwarded-for':ip};if(cookie)headers.cookie=cookie;
 const req={method,headers,body:data};const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(text){this.body=JSON.parse(text);}};
 await handler(req,res);return res;
}
async function signIn(ip='192.0.2.1',remember=true){const r=await call(sessionHandler,{method:'POST',data:{action:'login',password:process.env.TODO_PASSWORD,remember},ip});assert.equal(r.statusCode,200);return r.headers['set-cookie'].split(';')[0];}
const change=(cookie,action,requestId=randomUUID())=>call(tasksHandler,{method:'POST',cookie,data:{action,requestId}});
test('all task reads and writes reject unauthenticated callers',async()=>{
 assert.equal((await call(tasksHandler)).statusCode,401);
 assert.equal((await change(null,{type:'add',id:'x',title:'Private',kind:'do'})).statusCode,401);
 assert.equal(records.size,0);
});
test('successful login creates a secure 90-day server session',async()=>{
 const r=await call(sessionHandler,{method:'POST',data:{action:'login',password:process.env.TODO_PASSWORD,remember:true}});
 assert.equal(r.statusCode,200);const c=r.headers['set-cookie'];assert.match(c,/^__Host-todo-session=/);assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);assert.match(c,/Secure/);assert.match(c,new RegExp(`Max-Age=${SESSION_SECONDS}`));assert.doesNotMatch(JSON.stringify(r.body),/token|test-only/);
 const cookie=c.split(';')[0];assert.equal((await call(sessionHandler,{cookie})).statusCode,200);assert.equal(r.headers['cache-control'],'private, no-store, max-age=0');
 clockOffset=SESSION_SECONDS*1000+1;assert.equal((await call(sessionHandler,{cookie})).statusCode,401);
});
test('short session expires after twelve hours',async()=>{
 const cookie=await signIn('192.0.2.1',false);clockOffset=12*60*60*1000+1;assert.equal((await call(sessionHandler,{cookie})).statusCode,401);
});
test('forged browser cookie and old local unlock flag cannot authenticate',async()=>{
 assert.equal((await call(tasksHandler,{cookie:'now:unlocked=99999999999999; __Host-todo-session='+'a'.repeat(64)})).statusCode,401);
});
test('wrong-password attempts are rate limited',async()=>{
 for(let i=0;i<10;i++)assert.equal((await call(sessionHandler,{method:'POST',data:{action:'login',password:'wrong'}})).statusCode,401);
 assert.equal((await call(sessionHandler,{method:'POST',data:{action:'login',password:process.env.TODO_PASSWORD}})).statusCode,429);
 clockOffset=901000;assert.equal((await call(sessionHandler,{method:'POST',data:{action:'login',password:process.env.TODO_PASSWORD}})).statusCode,200);
});
test('cross-origin login, save, and logout are refused',async()=>{
 const cookie=await signIn();
 assert.equal((await call(sessionHandler,{method:'POST',origin:'https://evil.test',data:{action:'login',password:process.env.TODO_PASSWORD}})).statusCode,403);
 assert.equal((await call(tasksHandler,{method:'POST',cookie,origin:'https://evil.test',data:{action:{type:'drop',id:'x'},requestId:randomUUID()}})).statusCode,403);
 assert.equal((await call(sessionHandler,{method:'POST',cookie,origin:'https://evil.test',data:{action:'logout'}})).statusCode,403);
});
test('two signed-in devices read the same tasks; concurrent additions survive',async()=>{
 const a=await signIn('192.0.2.1'),b=await signIn('192.0.2.2');
 const responses=await Promise.all(Array.from({length:6},(_,i)=>change(i%2?a:b,{type:'add',id:String(i),title:'Task '+i,kind:'do'})));
 responses.forEach(r=>assert.equal(r.statusCode,200));
 const first=await call(tasksHandler,{cookie:a}),second=await call(tasksHandler,{cookie:b});assert.deepEqual(first.body,second.body);assert.equal(first.body.state.tasks.length,6);
});
test('replaying an interrupted save does not duplicate a flag toggle',async()=>{
 const cookie=await signIn();await change(cookie,{type:'add',id:'a',title:'A',kind:'do'});
 const id=randomUUID();const first=await change(cookie,{type:'flag',id:'a'},id);const retry=await change(cookie,{type:'flag',id:'a'},id);
 assert.deepEqual(retry.body,first.body);assert.deepEqual((await call(tasksHandler,{cookie})).body.state.flagged,['a']);
});
test('undo does not overwrite another device and logout revokes only its session',async()=>{
 const a=await signIn('192.0.2.1'),b=await signIn('192.0.2.2');
 const first=await change(a,{type:'add',id:'a',title:'A',kind:'do'});await change(b,{type:'add',id:'b',title:'B',kind:'do'});
 const undo=await change(a,{type:'undo',expectedRevision:first.body.state.revision,previous:first.body.previous});assert.equal(undo.statusCode,409);
 const logout=await call(sessionHandler,{method:'POST',cookie:a,data:{action:'logout'}});assert.equal(logout.statusCode,200);assert.match(logout.headers['set-cookie'],/Max-Age=0/);
 assert.equal((await call(tasksHandler,{cookie:a})).statusCode,401);assert.equal((await call(tasksHandler,{cookie:b})).statusCode,200);
});
test('changing the server password invalidates existing sessions',async()=>{
 const cookie=await signIn();process.env.TODO_PASSWORD='a-different-test-passphrase';assert.equal((await call(tasksHandler,{cookie})).statusCode,401);
});
test('missing configuration and database failure fail closed',async()=>{
 delete process.env.TODO_PASSWORD;assert.equal((await call(sessionHandler)).statusCode,503);process.env.TODO_PASSWORD='test-only-long-passphrase';
 const cookie=await signIn();globalThis.fetch=async()=>{throw Error('network down');};const r=await change(cookie,{type:'add',id:'a',title:'A',kind:'do'});assert.equal(r.statusCode,503);assert.equal(records.has('{todo}:state'),false);
});

test('new card notes and follow-up fields persist together across devices',async()=>{
 const a=await signIn('192.0.2.1'),b=await signIn('192.0.2.2');
 const result=await change(a,{type:'add',id:'notes',title:'Review file',kind:'wait',who:'Alex',checkDays:7,details:['  Check attachments  ','','Call client']});
 assert.equal(result.statusCode,200);
 const task=(await call(tasksHandler,{cookie:b})).body.state.tasks[0];
 assert.equal(task.title,'Review file');assert.equal(task.who,'Alex');assert.equal(task.checkDays,7);assert.deepEqual(task.details,['Check attachments','Call client']);
 const bad=await change(a,{type:'add',id:'bad',title:'Invalid notes',kind:'do',details:['x'.repeat(121)]});
 assert.equal(bad.statusCode,400);assert.equal((await call(tasksHandler,{cookie:b})).body.state.tasks.length,1);
});
