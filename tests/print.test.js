import test from 'node:test';
import assert from 'node:assert/strict';
import {cardPrintHTML,printCard} from '../src/printCard.js';

test('print sheet treats card text as text and includes waiting owner and all notes',()=>{
 const task={title:'Review <script>alert(1)</script>',kind:'wait',who:'Alex & Sam',details:['<img src=x onerror=alert(1)>','Second note']};
 const before=JSON.stringify(task);
 const html=cardPrintHTML(task,new Date('2026-09-12T12:00:00Z'));
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.match(html,/Alex &amp; Sam/);assert.match(html,/Second note/);
 assert.doesNotMatch(html,/<script|<img/);
 assert.equal(JSON.stringify(task),before);
});
test('blocked print popup gives an actionable message',()=>{
 globalThis.window={open:()=>null};
 try{assert.throws(()=>printCard({title:'Test'}),/Allow pop-ups/);}finally{delete globalThis.window;}
});
