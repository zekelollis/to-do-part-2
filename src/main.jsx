import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AuthGate from './AuthGate.jsx';
import {request} from './cloud';
async function signOut(){await request('/api/session',{method:'POST',data:{action:'logout'}});window.dispatchEvent(new Event('todo:signedout'));}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate><App onLock={signOut} hasPassphrase/></AuthGate></React.StrictMode>);
