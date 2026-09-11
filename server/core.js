import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {emptyState,normalize,applyAction} from '../src/model.js';
export const SESSION_SECONDS=90*24*60*60;
export const COOKIE='__Host-todo-session';
const digest=value=>createHash('sha256').update(value).digest('hex');
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function settings(){
 const password=process.env.TODO_PASSWORD;
 const url=process.env.to_do_part_2_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
 const token=process.env.to_do_part_2_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!password || password.length<12 || !url || !token)throw new HttpError(503,'Setup is not finished. Connect the database and set TODO_PASSWORD in Vercel, then redeploy.');
 if(!url.startsWith('https://'))throw new HttpError(503,'The database connection needs an HTTPS REST URL.');
 return {password,url,token};
}
export async function redis(command){
 const {url,token}=settings();
 let response;
 try {response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});}
 catch {throw new HttpError(503,'The shared task store is unavailable. Please try again.');}
 let data;try{data=await response.json();}catch{throw new HttpError(503,'The shared task store returned an unreadable response.');}
 if(!response.ok || data.error)throw new HttpError(503,'The shared task store is unavailable. Check the database connection in Vercel.');
 return data.result;
}
export function headers(res){res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');}
export function reply(res,status,value){headers(res);res.statusCode=status;res.end(JSON.stringify(value));}
export function fail(res,error){reply(res,error.status || 500,{error:error.status ? error.message : 'Could not complete that request. Please retry.'});}
export function checkOrigin(req){
 const host=req.headers.host;
 const local=process.env.NODE_ENV!=='production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host||'');
 const expected=`${local?'http':'https'}://${host}`;
 if(req.headers.origin!==expected)throw new HttpError(403,'This request must come from your To-Do app.');
 if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new HttpError(415,'Send a JSON request.');
}
export async function body(req){
 if(req.body!==undefined){const value=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(value))>1200000)throw new HttpError(413,'This request is too large.');return value;}
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1200000)throw new HttpError(413,'This request is too large.');}
 try{return JSON.parse(raw);}catch{throw new HttpError(400,'The request is not valid JSON.');}
}
const cookieName=req=>process.env.NODE_ENV!=='production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'')?'todo-session-dev':COOKIE;
export function tokenFrom(req){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(req)+'='));const token=raw?.slice(raw.indexOf('=')+1);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
export function cookie(req,token,maxAge){const secure=cookieName(req)===COOKIE?'; Secure':'';return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;}
const sessionKey=token=>`{todo}:session:${digest(token)}`;
const epoch=()=>digest(settings().password);
export async function authenticate(req){
 const token=tokenFrom(req);if(!token)throw new HttpError(401,'Sign in to open your tasks.');
 const value=await redis(['GET',sessionKey(token)]);
 if(!value)throw new HttpError(401,'Your session ended. Please sign in again.');
 const session=JSON.parse(value);
 if(session.expiresAt<=Date.now() || session.epoch!==epoch())throw new HttpError(401,'Your session ended. Please sign in again.');
 return {token,...session};
}
export const RATE_SCRIPT=`local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],900) end; return count`;
export async function login(req,password,remember=true){
 const config=settings();
 const ip=String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
 const key=`{todo}:login:${digest(ip)}`;
 const count=await redis(['EVAL',RATE_SCRIPT,1,key]);
 if(count>10)throw new HttpError(429,'Too many attempts. Try again in 15 minutes.');
 if(typeof password!=='string' || password.length>1024 || !timingSafeEqual(Buffer.from(digest(password)),Buffer.from(digest(config.password))))throw new HttpError(401,'That password doesn’t match. Try again.');
 const token=randomBytes(32).toString('hex');
 const seconds=remember?SESSION_SECONDS:12*60*60;
 const expiresAt=Date.now()+seconds*1000;
 await redis(['SET',sessionKey(token),JSON.stringify({epoch:epoch(),expiresAt}), 'EX',seconds]);
 return {token,seconds,expiresAt};
}
export async function logout(req){const token=tokenFrom(req);if(token)await redis(['DEL',sessionKey(token)]);}
export async function loadShared(){const value=await redis(['GET','{todo}:state']);return value?normalize(JSON.parse(value)):emptyState();}
export const CAS_SCRIPT=`
local cached=redis.call('GET',KEYS[2]); if cached then return {'cached',cached} end
local current=redis.call('GET',KEYS[1]); local revision=0
if current then revision=cjson.decode(current).revision end
if tonumber(ARGV[1])~=tonumber(revision) then return {'conflict',''} end
redis.call('SET',KEYS[1],ARGV[2]); redis.call('SET',KEYS[2],ARGV[3],'EX',86400)
return {'ok',ARGV[3]}
`;
export function validateAction(a){
 if(!a || typeof a!=='object' || Array.isArray(a))throw new HttpError(400,'Choose a task action.');
 const types=['add','edit','done','drop','restore','now','renew','skip','deck','flag','handoff','takeback','nudge','shuffleChoice','theme','import','undo'];
 if(!types.includes(a.type))throw new HttpError(400,'Unknown task action.');
 if(!['theme','import','undo'].includes(a.type) && (typeof a.id!=='string'||a.id.length>100))throw new HttpError(400,'Choose a valid task.');
 if(['add','edit'].includes(a.type) && (typeof a.title!=='string'||!a.title.trim()||a.title.length>500))throw new HttpError(400,'Use a task title of 1–500 characters.');
 if(a.type==='add'&&!['do','wait'].includes(a.kind))throw new HttpError(400,'Choose a task type.');
 if(a.type==='add' && ((a.details!==undefined&&(!Array.isArray(a.details)||a.details.length>5||a.details.some(x=>typeof x!=='string'||x.length>120)))||(a.who!==undefined&&(typeof a.who!=='string'||a.who.length>100))||(a.checkDays!==undefined&&![1,2,3,7].includes(a.checkDays))))throw new HttpError(400,'Check the new card’s notes and follow-up window.');
 if(a.type==='edit' && (typeof a.who!=='string'||a.who.length>100||!Array.isArray(a.details)||a.details.length>5||a.details.some(x=>typeof x!=='string'||x.length>120)||![1,2,3,7].includes(a.checkDays)))throw new HttpError(400,'Check the task’s notes and follow-up window.');
 if(a.type==='shuffleChoice' && (!Array.isArray(a.ids)||a.ids.length!==2||a.ids.some(x=>typeof x!=='string')||!a.ids.includes(a.id)))throw new HttpError(400,'Choose a task from this round.');
 if(a.type==='theme'&&!['light','dark'].includes(a.theme))throw new HttpError(400,'Choose a theme.');
 if(a.type==='undo'&&!Number.isSafeInteger(a.expectedRevision))throw new HttpError(400,'Choose a valid undo.');
}
export async function saveShared(action,requestId){
 validateAction(action);
 if(!/^[a-f0-9-]{36}$/.test(requestId||''))throw new HttpError(400,'This change needs a valid request ID.');
 const operationKey=`{todo}:request:${requestId}`;
 // A retry uses the same ID; only the original operation is committed.
 const cached=await redis(['GET',operationKey]);if(cached)return JSON.parse(cached);
 for(let attempt=0;attempt<8;attempt++){
  const previous=await loadShared();
  let result;
  try{
   if(action.type==='add'&&previous.tasks.some(t=>t.id===action.id))throw new HttpError(409,'That task was already captured. Refresh to see it.');
   if(['skip','renew'].includes(action.type)&&action.id!==previous.nowId)throw new HttpError(409,'Your focus changed on another device. Refresh before changing it.');
   if(action.type==='undo'){
    if(previous.revision!==action.expectedRevision)throw new HttpError(409,'Another change was saved since that action. Restore the task from History instead.');
    result={state:{...normalize(action.previous),revision:previous.revision+1,updatedAt:Date.now()},message:'Undone'};
   }else result=applyAction(previous,action);
  }catch(e){if(e.status)throw e;throw new HttpError(409,e.message);}
  result.previous=previous;
  if(Buffer.byteLength(JSON.stringify(result))>900000)throw new HttpError(413,'The task collection is too large for this save. Export a backup before reducing it.');
  const [status,value]=await redis(['EVAL',CAS_SCRIPT,2,'{todo}:state',operationKey,previous.revision,JSON.stringify(result.state),JSON.stringify(result)]);
  if(status==='ok'||status==='cached')return JSON.parse(value);
 }
 throw new HttpError(409,'Several changes arrived together. Please try again.');
}
