export async function request(path,{method='GET',data,signal}={}) {
 let response;
 try {response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,signal:signal || AbortSignal.timeout(15000)});}
 catch {const error=Error('Can’t reach your shared tasks. Check your connection and retry.');error.status=0;throw error;}
 let result;try{result=await response.json();}catch{throw Error('The server did not respond correctly. Confirm the API files were deployed.');}
 if(!response.ok){const error=Error(result.error || 'The request could not be completed.');error.status=response.status;if(response.status===401 && path!=='/api/session')window.dispatchEvent(new Event('todo:expired'));throw error;}
 return result;
}
export async function readState(){return (await request('/api/tasks')).state;}
export async function commit(action,requestId=crypto.randomUUID()){
 return request('/api/tasks',{method:'POST',data:{action,requestId}});
}
