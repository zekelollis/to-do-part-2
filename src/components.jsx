import React, {useEffect,useRef,useState} from 'react';
import {DETAIL_MAX,DETAIL_LEN,dueAt,DAY} from './model';

export function Icon({name,size=18,...props}) {
  const paths={plus:<path d="M12 5v14M5 12h14"/>,check:<path d="m5 12 4 4L19 6"/>,arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,flag:<><path d="M5 21V4m0 0c5-5 9 5 14 0v9c-5 5-9-5-14 0"/></>,sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,moon:<path d="M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z"/>,search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,shuffle:<><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 5-5m3-4c1-2 2-3 4-3h3m-4-4 4 4-4 4"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,download:<><path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/></>,back:<path d="M19 12H5m5-5-5 5 5 5"/>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.more}</svg>;
}
export function Modal({title,children,onClose,wide=false}) {
  const ref=useRef(null);
  useEffect(()=>{const prior=document.activeElement;ref.current.showModal();return()=>{ref.current?.close();if(prior?.isConnected) prior.focus();};},[]);
  return <dialog ref={ref} className={`dialog ${wide?'dialog-wide':''}`} aria-labelledby="dialog-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div>{children}
  </dialog>;
}
export function dueLabel(task,now=Date.now()) {
  const delta=dueAt(task)-now;
  if(delta<=0) {const days=Math.floor(-delta/DAY);return days ? `${days}d overdue` : 'Check in today';}
  if(delta<DAY) return 'Check in within a day';
  return `Check in ${Math.ceil(delta/DAY)} days`;
}
export function TaskEditor({task,state,act,onClose,initialFocus}) {
  const [title,setTitle]=useState(task.title);
  const [who,setWho]=useState(task.who || '');
  const [days,setDays]=useState(task.checkDays || 2);
  const [details,setDetails]=useState(task.details.length ? task.details : ['']);
  const [working,setWorking]=useState(false);
  const [localError,setLocalError]=useState('');
  const dirty=title!==task.title || who!==(task.who||'') || days!==(task.checkDays||2) || JSON.stringify(details.filter(x=>x.trim()))!==JSON.stringify(task.details);
  const [discard,setDiscard]=useState(false);
  const noteRef=useRef(null);
  useEffect(()=>{if(initialFocus==='details')noteRef.current?.focus();},[]);
  const close=()=>dirty ? setDiscard(true) : onClose();
  const save=async(e)=>{e.preventDefault();setWorking(true);const ok=await act({type:'edit',id:task.id,title,who,checkDays:Number(days),details:details.filter(x=>x.trim()),expectedTask:JSON.stringify(task)});setWorking(false);if(ok)onClose();else setLocalError('Changes could not be saved. Your draft is still here. Close this panel to see the error, or try again.');};
  const action=async(type)=>{setWorking(true);const ok=await act({type,id:task.id});setWorking(false);if(ok)onClose();else setLocalError('That action could not be saved. Please try again.');};
  const archived=task.done || task.deletedAt;
  return <Modal title={archived ? (task.deletedAt?'In the trash':'Completed') : task.kind==='wait'?'Waiting on':'Task details'} onClose={close}>
    {discard ? <div className="discard"><h3>Keep these edits?</h3><p>You have changes that haven’t been saved.</p><div className="button-row"><button onClick={()=>setDiscard(false)}>Keep editing</button><button className="danger" onClick={onClose}>Discard edits</button></div></div> : <>
    <form onSubmit={save} className="editor">
      <label>Task<input autoFocus={initialFocus!=='details'} value={title} onChange={e=>setTitle(e.target.value)} required maxLength={500}/></label>
      {task.kind==='wait' && <div className="field-pair"><label>Who has it?<input value={who} onChange={e=>setWho(e.target.value)} placeholder="Name (optional)" maxLength={100}/></label><label>Check back<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,7].map(n=><option key={n} value={n}>Every {n} day{n===1?'':'s'}</option>)}</select></label></div>}
      <div className="notes-heading"><span>Notes</span><span className="muted">Five short lines, just what you need.</span></div>
      {details.map((line,i)=><div className="note-input" key={i}><span className="note-mark"/><input ref={i===0?noteRef:null} value={line} maxLength={DETAIL_LEN} aria-label={`Note ${i+1}`} placeholder="A useful detail…" onChange={e=>setDetails(details.map((x,j)=>i===j?e.target.value:x))}/><button type="button" className="icon-button" aria-label={`Remove note ${i+1}`} onClick={()=>setDetails(details.filter((_,j)=>j!==i))}><Icon name="close" size={15}/></button></div>)}
      {details.length<DETAIL_MAX && <button type="button" className="text-button" onClick={()=>setDetails([...details,''])}><Icon name="plus" size={15}/>Add a line</button>}
      {localError && <p role="alert" className="form-error">{localError}</p>}
      <div className="editor-save"><button type="button" className="text-button" onClick={close}>Cancel</button><button className="primary" disabled={working || !title.trim()}>Save changes<Icon name="check" size={16}/></button></div>
    </form>
    <div className="editor-actions"><span className="eyebrow">{dirty?'Save or cancel edits to use task actions':'Move this forward'}</span><div className="button-row">
    {archived ? <button disabled={working||dirty} onClick={()=>action('restore')}>Restore task</button> : task.kind==='wait' ? <><button disabled={working||dirty} onClick={()=>action('nudge')}>Nudged</button><button disabled={working||dirty} onClick={()=>action('takeback')}>Take it back</button><button disabled={working||dirty} onClick={()=>action('done')}>Landed<Icon name="check" size={15}/></button></> : <>
      {task.id!==state.nowId && <button disabled={working||dirty} onClick={()=>action('now')}>Make it now<Icon name="arrow" size={15}/></button>}
      {task.id!==state.nowId && <button disabled={working||dirty} onClick={()=>action('deck')}>{state.deck.includes(task.id)?'Take off deck':'Put on deck'}</button>}
      <button disabled={working||dirty} onClick={()=>action('flag')}>{state.flagged.includes(task.id)?'Remove flag':'Flag'}<Icon name="flag" size={15}/></button><button disabled={working||dirty} onClick={()=>action('handoff')}>Hand it off</button><button disabled={working||dirty} onClick={()=>action('done')}>Done<Icon name="check" size={15}/></button>
    </>}
    {!task.deletedAt && <button className="danger text-button" disabled={working||dirty} onClick={()=>action('drop')}>Move to trash</button>}
    </div></div></>}
  </Modal>;
}
