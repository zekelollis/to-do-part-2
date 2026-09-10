import {emptyState, normalize, applyAction} from './model.js';
const DB_NAME='now-desk-v3';
const LEGACY_KEY='now:state:v2';
let opening;
export function openDatabase() {
  if(!opening) opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onerror=()=>{opening=null;reject(request.error);};
    request.onblocked=()=>{opening=null;reject(Error('Another tab is blocking the task store. Close other Now tabs and retry.'));};
    request.onsuccess=()=>{const db=request.result; db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  });
  return opening;
}
export async function readState() {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite');
    const store=tx.objectStore('state');
    const request=store.get('main');
    let state;
    let failure;
    request.onsuccess=()=>{
      try {
        if(request.result) state=normalize(request.result);
        else {
          const raw=localStorage.getItem(LEGACY_KEY);
          state=raw ? normalize(JSON.parse(raw)) : emptyState();
          store.put(state,'main'); // Original v2 localStorage is deliberately untouched.
        }
      } catch(e) {failure=e;tx.abort();}
    };
    tx.oncomplete=()=>resolve(state);
    tx.onabort=tx.onerror=()=>reject(failure || tx.error || Error('Unable to load tasks.'));
  });
}
export async function commit(action) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite');
    const store=tx.objectStore('state');
    const request=store.get('main');
    let result;
    let failure;
    request.onsuccess=()=>{
      try {
        const previous=normalize(request.result);
        if(action.type==='undo') {
          if(previous.revision!==action.expectedRevision) throw Error('Another change was saved since that action. Restore the task from History instead.');
          result={state:{...normalize(action.previous),revision:previous.revision+1,updatedAt:Date.now()},message:'Undone'};
        } else result=applyAction(previous,action);
        result.previous=previous;
        store.put(result.state,'main');
      } catch(e) {failure=e;tx.abort();}
    };
    tx.oncomplete=()=>resolve(result);
    tx.onabort=tx.onerror=()=>reject(failure || tx.error || Error('Could not save. Your last saved tasks are safe.'));
  });
}
