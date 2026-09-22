import React,{useEffect,useRef,useState} from 'react';
import {listAttachments,addAttachments,removeAttachment,downloadAttachment} from './attachments';
export default function Attachments({taskId}){
 const [items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[over,setOver]=useState(false);
 const input=useRef(null),lock=useRef(false);
 useEffect(()=>{let live=true;const refresh=()=>listAttachments(taskId).then(v=>{if(live){setItems(v);setLoading(false);}}).catch(()=>{if(live){setError('This browser could not open attachment storage.');setLoading(false);}});refresh();window.addEventListener('focus',refresh);return()=>{live=false;window.removeEventListener('focus',refresh);};},[taskId]);
 const run=async fn=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();setItems(await listAttachments(taskId));}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}};
 const add=files=>run(()=>addAttachments(taskId,files));
 return <section className="attachments" aria-label="Local attachments" aria-busy={busy}>
 <h3>Attachments <small>This browser only</small></h3>
 <p>Saved immediately on this computer, separately from card edits. Not synced or included in task backups. Keep the original email; clearing browser data can remove these copies.</p>
 <div className={`attachment-drop ${over?'drag-over':''}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();e.stopPropagation();setOver(false);if(!loading)add(Array.from(e.dataTransfer.files));}}>
 <button type="button" disabled={busy||loading} onClick={()=>input.current.click()}>Choose files</button><span> or drop files here</span>
 <input hidden ref={input} type="file" multiple onChange={e=>{const files=Array.from(e.target.files);e.target.value='';if(files.length)add(files);}}/>
 <p>Classic Outlook: if dragging the email does not work, save it as a .msg file first. Up to 20 MB per file.</p>
 </div>
 {error&&<p className="form-error" role="alert">{error}</p>}
 {loading?<p>Loading attachments…</p>:items.length?<ul>{items.map(item=><li key={item.id}><div><strong>{item.name}</strong><small>{(item.size/1024).toFixed(0)} KB</small></div><button type="button" disabled={busy} onClick={()=>downloadAttachment(item)}>Download</button><button type="button" disabled={busy} aria-label={`Remove ${item.name}`} onClick={()=>{if(window.confirm(`Remove the local copy of “${item.name}”?`))run(()=>removeAttachment(item.id));}}>Remove</button></li>)}</ul>:<p>No attachments saved in this browser.</p>}
 <p>Download an email file, then open it in Outlook. This is a saved copy, not a link to the original conversation.</p>
 </section>;
}
