import {authenticate,checkOrigin,body,loadShared,saveShared,reply,fail,HttpError} from '../server/core.js';
export default async function handler(req,res){
 try{
  await authenticate(req);
  if(req.method==='GET')return reply(res,200,{state:await loadShared()});
  if(req.method!=='POST')throw new HttpError(405,'Method not allowed.');
  checkOrigin(req);const input=await body(req);
  return reply(res,200,await saveShared(input.action,input.requestId));
 }catch(e){fail(res,e);}
}
