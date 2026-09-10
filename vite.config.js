import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
// Local development only; Vercel deploys the files in api/ as server functions.
export default defineConfig(({mode})=>({
 plugins:[react(),{
  name:'todo-local-api',
  apply:'serve',
  async configureServer(server){
   const env=loadEnv(mode,process.cwd(),'');
   for(const name of ['TODO_PASSWORD','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'])if(env[name]&&!process.env[name])process.env[name]=env[name];
   const [{default:session},{default:tasks}]=await Promise.all([import('./api/session.js'),import('./api/tasks.js')]);
   server.middlewares.use((req,res,next)=>{
    const path=req.url?.split('?')[0];
    if(path==='/api/session')return session(req,res);
    if(path==='/api/tasks')return tasks(req,res);
    next();
   });
  }
 }]
}));
