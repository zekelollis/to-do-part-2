import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {addAttachments,listAttachments,removeAttachment,MAX_FILE} from '../src/attachments.js';
import {claimLink,applyAction,emptyState,normalize} from '../src/model.js';
import {validateAction} from '../server/core.js';

test('claim links survive older-client edits and reject unsafe links',()=>{
 let s=applyAction(emptyState(),{type:'add',id:'a',title:'A',kind:'do',claimUrl:'https://example.sharepoint.com/sites/claims?id=123'}).state;
 s=applyAction(s,{type:'edit',id:'a',title:'Updated',who:'',details:[],checkDays:2}).state;
 assert.equal(s.tasks[0].claimUrl,'https://example.sharepoint.com/sites/claims?id=123');
 for(const value of ['javascript:alert(1)','file:///tmp/test','https://user:pass@example.com',{},'x'.repeat(4097)]){
  assert.throws(()=>claimLink(value));
  assert.throws(()=>validateAction({type:'add',id:'x',title:'X',kind:'do',claimUrl:value}));
 }
 assert.throws(()=>normalize({...s,tasks:[{...s.tasks[0],claimUrl:'javascript:alert(1)'}]}));
 s=applyAction(s,{type:'edit',id:'a',title:'Updated',who:'',details:[],checkDays:2,claimUrl:''}).state;
 assert.equal(s.tasks[0].claimUrl,'');
});
test('local files persist exact bytes, stay scoped to card, and can be removed',async()=>{
 const file=new Blob(['email bytes'],{type:'application/octet-stream'});file.name='message.msg';
 await addAttachments('a',[file]);
 const [saved]=await listAttachments('a');
 assert.equal(saved.name,'message.msg');assert.equal(await saved.file.text(),'email bytes');
 assert.deepEqual(await listAttachments('b'),[]);
 await removeAttachment(saved.id);assert.deepEqual(await listAttachments('a'),[]);
});
test('attachment batches fail atomically at limits and empty Outlook drops are explained',async()=>{
 const file=new Blob(['x']);file.name='test.msg';
 await addAttachments('limit',Array(9).fill(file));
 await assert.rejects(addAttachments('limit',[file,file]),/No files from this batch/);
 assert.equal((await listAttachments('limit')).length,9);
 await assert.rejects(addAttachments('limit',[{size:MAX_FILE+1}]),/20 MB/);
 await assert.rejects(addAttachments('limit',[]),/Save the email from Outlook/);
});
