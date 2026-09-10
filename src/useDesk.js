import {useCallback,useEffect,useRef,useState} from 'react';
import {readState,commit} from './cloud';
export function useDesk(){
 const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState(null),[failed,setFailed]=useState(null),[lastSync,setLastSync]=useState(null);
 const channel=useRef(null),pending=useRef(false),readPending=useRef(false);
 const adopt=next=>{setState(old=>!old||next.revision>=old.revision?next:old);setLastSync(Date.now());};
 const load=useCallback(async({background=false}={})=>{
  if(readPending.current||pending.current)return;
  readPending.current=true;
  try{adopt(await readState());if(!background)setError('');}catch(e){setError(e.message);}finally{readPending.current=false;}
 },[]);
 useEffect(()=>{
  load();
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('todo-cloud');channel.current.onmessage=()=>load({background:true});}
  const visible=()=>{if(document.visibilityState==='visible')load({background:true});};
  const timer=setInterval(visible,20000);
  window.addEventListener('focus',visible);window.addEventListener('online',visible);window.addEventListener('todo:signedin',visible);document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);channel.current?.close();window.removeEventListener('focus',visible);window.removeEventListener('online',visible);window.removeEventListener('todo:signedin',visible);document.removeEventListener('visibilitychange',visible);};
 },[load]);
 const perform=useCallback(async(action,options={},requestId=crypto.randomUUID())=>{
  if(pending.current)return false;
  pending.current=true;setBusy(true);
  try{
   const result=await commit(action,requestId);adopt(result.state);setError('');setFailed(null);
   channel.current?.postMessage({revision:result.state.revision});
   if(!options.quiet)setToast({message:result.message,undo:options.undo!==false?{type:'undo',expectedRevision:result.state.revision,previous:result.previous}:null});
   return true;
  }catch(e){
   if(e.status===0||e.status>=500){setFailed({action,options,requestId});setError(`${e.message} The save is unconfirmed. Retry the pending save before making another change.`);}
   else{setFailed(null);setError(e.message);}
   return false;
  }finally{pending.current=false;setBusy(false);}
 },[]);
 const act=useCallback((action,options)=>{
  if(failed){setError('Retry the pending save first. Your draft is still here.');return Promise.resolve(false);}
  return perform(action,options);
 },[failed,perform]);
 const retry=useCallback(()=>failed?perform(failed.action,failed.options,failed.requestId):load(),[failed,perform,load]);
 return {state,error,busy:busy||!!failed,toast,setToast,act,retry,lastSync,pendingAction:failed?.action};
}
