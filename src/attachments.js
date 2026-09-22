const DB='todo-local-attachments-v1';
export const MAX_FILE=20*1024*1024;
function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('files',{keyPath:'id'});s.createIndex('taskId','taskId');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(mode,run){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);let result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(tx.error||Error('Attachment storage failed.'));};tx.onerror=()=>{};try{run(tx.objectStore('files'),value=>{result=value;});}catch(e){tx.abort();reject(e);}});}
export function listAttachments(taskId){return transaction('readonly',(s,done)=>{const r=s.index('taskId').getAll(taskId);r.onsuccess=()=>done(r.result);});}
export async function addAttachments(taskId,files){
 if(!files.length)throw Error('No file was received. Save the email from Outlook as a .msg file, then choose or drag that file here.');
 if(files.some(f=>!f.size||f.size>MAX_FILE))throw Error('Choose nonempty files up to 20 MB each.');
 const records=files.map(file=>({id:crypto.randomUUID(),taskId,name:file.name,size:file.size,file,addedAt:Date.now()}));
 return transaction('readwrite',(s,done)=>{const r=s.index('taskId').getAll(taskId);r.onsuccess=()=>{const old=r.result;if(old.length+records.length>10||[...old,...records].reduce((n,f)=>n+f.size,0)>100*1024*1024){s.transaction.abort();return;}records.forEach(f=>s.add(f));done(records);};}).catch(()=>{throw Error('Files could not be stored. Each card allows 10 files / 100 MB, and your browser must have space available. No files from this batch were added.');});
}
export function removeAttachment(id){return transaction('readwrite',(s)=>s.delete(id));}
export function downloadAttachment(item){const url=URL.createObjectURL(item.file);const a=document.createElement('a');a.href=url;a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
