import React,{useEffect,useState,useRef} from 'react';
import {request} from './cloud';
import './styles.css';
export default function AuthGate({children}){
 const generation=useRef(0);
 const expiresAt=useRef(0);
 const [open,setOpen]=useState(false);
 const [mounted,setMounted]=useState(false);
 const [checking,setChecking]=useState(true);
 const [password,setPassword]=useState('');
 const [remember,setRemember]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let alive=true;
  const check=async()=>{if(expiresAt.current&&Date.now()>=expiresAt.current)setOpen(false);const version=generation.current;try{const s=await request('/api/session');if(alive&&generation.current===version){expiresAt.current=s.expiresAt;setOpen(s.authenticated);setMounted(true);setError('');}}catch(e){if(alive&&generation.current===version){if(e.status===401)setOpen(false);else setError(e.message);}}finally{if(alive&&generation.current===version)setChecking(false);}};
  check();
  const expired=()=>{generation.current++;setOpen(false);setError('Your session ended. Sign in to continue. Your open draft is still here.');};
  const signedout=()=>{generation.current++;setOpen(false);setMounted(false);setError('');};
  window.addEventListener('todo:expired',expired);window.addEventListener('todo:signedout',signedout);
  const focus=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',focus);
  const timer=setInterval(focus,60000);
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',focus);window.removeEventListener('todo:expired',expired);window.removeEventListener('todo:signedout',signedout);};
 },[]);
 useEffect(()=>{window.dispatchEvent(new Event(open?'todo:show-content':'todo:hide-content'));},[open]);
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const session=await request('/api/session',{method:'POST',data:{action:'login',password,remember}});expiresAt.current=session.expiresAt;generation.current++;setPassword('');setOpen(true);setMounted(true);window.dispatchEvent(new Event('todo:signedin'));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <>{!open&&<div className="auth-screen"><form onSubmit={submit} className="auth-card"><span className="wordmark">To-Do</span><h1>{checking?'Opening your desk…':'Your desk, wherever you are.'}</h1><p>Sign in to your shared tasks.</p>{!checking&&<><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required autoFocus value={password} maxLength={1024} onChange={e=>setPassword(e.target.value)}/><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember this browser for 90 days</label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="primary" disabled={busy||!password}>{busy?'Signing in…':'Open my desk'}</button><small>{remember?'Use this on devices you trust.':'You’ll stay signed in for up to 12 hours.'}</small></>}</form></div>}<div hidden={!open}>{mounted&&children}</div></>;
}
