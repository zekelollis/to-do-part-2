import {settings,authenticate,login,logout,cookie,checkOrigin,body,reply,fail,HttpError} from '../server/core.js';
export default async function handler(req,res){
 try{
  settings();
  if(req.method==='GET') {const session=await authenticate(req);return reply(res,200,{authenticated:true,expiresAt:session.expiresAt});}
  if(req.method!=='POST')throw new HttpError(405,'Method not allowed.');
  checkOrigin(req);const input=await body(req);
  if(input.action==='logout'){await logout(req);res.setHeader('Set-Cookie',cookie(req,'',0));return reply(res,200,{authenticated:false});}
  if(input.action!=='login')throw new HttpError(400,'Choose a sign-in action.');
  const session=await login(req,input.password,input.remember!==false);
  res.setHeader('Set-Cookie',cookie(req,session.token,session.seconds));
  return reply(res,200,{authenticated:true,expiresAt:session.expiresAt});
 }catch(e){fail(res,e);}
}
