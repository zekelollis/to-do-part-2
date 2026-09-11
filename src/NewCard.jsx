import React,{useRef,useState} from 'react';
import {Modal,Icon} from './components';
import {newId,DETAIL_MAX,DETAIL_LEN} from './model';
export default function NewCard({initialKind,act,onClose,busy,pendingSave,retrySave,error}){
 const id=useRef(newId());
 const [title,setTitle]=useState(''),[kind,setKind]=useState(initialKind),[who,setWho]=useState(''),[days,setDays]=useState(2),[notes,setNotes]=useState(['']);
 const [saving,setSaving]=useState(false),[discard,setDiscard]=useState(false),[message,setMessage]=useState('');
 const blocked=saving||busy||pendingSave;
 const dirty=title.trim()||who.trim()||notes.some(x=>x.trim());
 const close=()=>{if(blocked){setMessage('Please finish or retry the pending save before closing this card.');return;}if(dirty)setDiscard(true);else onClose();};
 const submit=async e=>{e.preventDefault();if(blocked)return;setSaving(true);setMessage('');const ok=await act({type:'add',id:id.current,title,kind,who,checkDays:days,details:notes.filter(x=>x.trim())});setSaving(false);if(ok)onClose();else setMessage('The card could not be saved. Your title and notes are still here.');};
 return <Modal title="New card" onClose={close}>{discard?<div className="discard"><h3>Keep this draft?</h3><p>The card hasn’t been added yet.</p><div className="button-row"><button onClick={()=>setDiscard(false)}>Keep editing</button><button className="danger" onClick={onClose}>Discard draft</button></div></div>:<form className="editor" onSubmit={submit}>
 <label>Title<input autoFocus required maxLength={500} disabled={blocked} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs doing?"/></label>
 <label>Where it belongs<select value={kind} disabled={blocked} onChange={e=>setKind(e.target.value)}><option value="do">Mine</option><option value="wait">Waiting on</option></select></label>
 {kind==='wait'&&<div className="field-pair"><label>Who has it?<input maxLength={100} disabled={blocked} value={who} onChange={e=>setWho(e.target.value)} placeholder="Name (optional)"/></label><label>Check back<select value={days} disabled={blocked} onChange={e=>setDays(Number(e.target.value))}>{[1,2,3,7].map(n=><option key={n} value={n}>Every {n} day{n===1?'':'s'}</option>)}</select></label></div>}
 <div className="notes-heading"><span>Notes</span><span className="muted">Optional · up to five short lines</span></div>
 {notes.map((note,i)=><div className="note-input" key={i}><span className="note-mark"/><input aria-label={`New card note ${i+1}`} maxLength={DETAIL_LEN} disabled={blocked} value={note} onChange={e=>setNotes(notes.map((n,j)=>i===j?e.target.value:n))} placeholder="A useful detail…"/><button type="button" className="icon-button" disabled={blocked} aria-label={`Remove new card note ${i+1}`} onClick={()=>setNotes(notes.filter((_,j)=>i!==j))}><Icon name="close" size={15}/></button></div>)}
 {notes.length<DETAIL_MAX&&<button type="button" className="text-button" disabled={blocked} onClick={()=>setNotes([...notes,''])}><Icon name="plus" size={15}/>Add a line</button>}
 {(message||error)&&<p role="alert" className="form-error">{error||message}</p>}
 {pendingSave&&<button type="button" onClick={retrySave}>Retry pending save</button>}
 <div className="editor-save"><button type="button" className="text-button" onClick={close}>Cancel</button><button className="primary" disabled={blocked||!title.trim()}>{saving?'Adding…':'Add card'}<Icon name="plus" size={16}/></button></div>
 </form>}</Modal>;
}
