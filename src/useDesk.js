import {useCallback,useEffect,useRef,useState} from 'react';
import {readState,commit} from './storage';
export function useDesk() {
  const [state,setState]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState(null);
  const channel=useRef(null);
  const pending=useRef(false);
  const load=useCallback(async()=>{
    try {const next=await readState();setState(old=>!old || next.revision>=old.revision ? next : old);setError('');}
    catch(e) {setError(e.message || 'Could not open your task store. Please retry.');}
  },[]);
  useEffect(()=>{
    load();
    if(typeof BroadcastChannel !== 'undefined') {channel.current=new BroadcastChannel('now-desk');channel.current.onmessage=load;}
    const visible=()=>{if(document.visibilityState==='visible') load();};
    window.addEventListener('focus',load);document.addEventListener('visibilitychange',visible);
    return()=>{channel.current?.close();window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',visible);};
  },[load]);
  const act=useCallback(async(action,{quiet=false,undo=true}={})=>{
    if(pending.current) return false;
    pending.current=true;setBusy(true);
    try {
      const result=await commit(action);
      setState(old=>!old || result.state.revision>=old.revision ? result.state : old);setError('');
      channel.current?.postMessage({revision:result.state.revision});
      if(!quiet) setToast({message:result.message,undo:undo ? {type:'undo',expectedRevision:result.state.revision,previous:result.previous} : null});
      return true;
    } catch(e) {setError(e.message || 'Could not save. Please try again.');return false;}
    finally {pending.current=false;setBusy(false);}
  },[]);
  return {state,error,busy,toast,setToast,act,retry:load};
}
