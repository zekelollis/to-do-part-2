const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Build a standalone sheet containing only the selected saved card.
export function cardPrintHTML(task,now=new Date()){
 const status=task.deletedAt?'In trash':task.done?'Completed':task.kind==='wait'?'Waiting on':'To do';
 const notes=(task.details||[]).filter(x=>x.trim());
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>To-Do card</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f2efe8;color:#222;font:16px/1.6 Arial,sans-serif}.toolbar{max-width:760px;margin:24px auto;padding:0 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}button{padding:10px 18px;border:1px solid #aaa;background:white;border-radius:4px;cursor:pointer;font:inherit}.hint{font-size:13px;color:#555}.sheet{max-width:760px;margin:24px auto;padding:40px;background:white;border:1px solid #ccc}.brand{font:28px Georgia,serif;margin-bottom:24px}.status{font-size:12px;text-transform:uppercase;letter-spacing:1px}h1{font:32px/1.2 Georgia,serif;margin:14px 0 22px;overflow-wrap:anywhere}.owner,li{overflow-wrap:anywhere;white-space:pre-wrap}h2{font-size:16px;margin-top:28px}ul{padding-left:22px}li{padding:6px 0;break-inside:avoid}.printed{margin-top:32px;padding-top:12px;border-top:1px solid #ccc;font-size:12px;color:#555}
 @page{margin:18mm}@media print{body{background:white}.toolbar{display:none}.sheet{max-width:none;margin:0;padding:0;border:0}h1,h2{break-after:avoid}}
 </style></head><body><div class="toolbar"><button id="print">Print / Save as PDF</button><button id="close">Close</button><span class="hint">If the print dialog doesn’t open, use the Print button.</span></div><main class="sheet"><div class="brand">To-Do</div><div class="status">${escapeHTML(status)}</div><h1>${escapeHTML(task.title)}</h1>${task.kind==='wait'?`<p class="owner">Waiting on: ${escapeHTML(task.who||'Unassigned')}</p>`:''}${notes.length?`<h2>Notes</h2><ul>${notes.map(n=>`<li>${escapeHTML(n)}</li>`).join('')}</ul>`:''}<div class="printed">Printed ${escapeHTML(now.toLocaleString())}</div></main></body></html>`;
}

export function printCard(task){
 const page=window.open('','_blank','popup,width=850,height=900');
 if(!page)throw Error('Allow pop-ups for To-Do, then click Print again.');
 page.opener=null;
 page.document.open();
 page.document.write(cardPrintHTML(task));
 page.document.close();
 page.document.getElementById('print').addEventListener('click',()=>page.print());
 page.document.getElementById('close').addEventListener('click',()=>page.close());
 page.focus();
 page.print();
}
