import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Gate,{lock} from './Gate.jsx';
function handleLock(){lock();window.dispatchEvent(new Event('now:lock'));}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Gate><App onLock={handleLock} hasPassphrase={!!import.meta.env.VITE_NOW_PASSPHRASE}/></Gate></React.StrictMode>);
