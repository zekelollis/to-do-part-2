import React,{useEffect,useRef,useState} from 'react';
import {useDesk} from './useDesk';
import {mine,waits,active,dueAt,newId,STALE_MS,shuffleCandidates,normalize} from './model';
import {Icon,Modal,TaskEditor,dueLabel} from './components';
import './styles.css';

export default function App({onLock,hasPassphrase}) {
  const {state,error,busy,toast,setToast,act,retry}=useDesk();
  const [view,setView]=useState('now');
  const [query,setQuery]=useState('');
  const [draft,setDraft]=useState('');
  const [kind,setKind]=useState('do');
  const [editor,setEditor]=useState(null);
  const [tools,setTools]=useState(false);
  const [hidden,setHidden]=useState(false);
  const [round,setRound]=useState(null);
  const [importState,setImportState]=useState(null);
  const [importError,setImportError]=useState('');
  const [clock,setClock]=useState(Date.now());
  const capture=useRef(null);
  const file=useRef(null);
  const choosing=useRef(false);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(state){document.documentElement.dataset.theme=state.theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.theme==='dark'?'#151e28':'#f2efe8');}},[state?.theme]);
  const current=state?.tasks.find(t=>t.id===state.nowId && active(t));
  const openTask=(t,focus)=>setEditor({task:structuredClone(t),focus});
  const startShuffle=async()=>{
    const candidates=shuffleCandidates(state);
    if(candidates.length<2){if(current)await act({type:'renew'});return;}
    setRound({champion:candidates[0],challengers:candidates.slice(1),index:0,total:candidates.length-1});
  };
  useEffect(()=>{
    const key=e=>{
      if(hidden || editor || tools || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;
      if(round){if(e.key==='1'||e.key==='2'){e.preventDefault();choose(e.key==='1'?round.champion:round.challengers[round.index]);}else if(e.key==='Escape')setRound(null);return;}
      if(e.key==='/'){e.preventDefault();capture.current?.focus();}
      else if(e.key==='s'){e.preventDefault();startShuffle();}
      else if(e.key==='w'){setView(view==='waiting'?'now':'waiting');setQuery('');}
      else if(e.key==='Escape'){setView('now');setQuery('');}
      else if(view==='now'&&current){
        if(e.key==='x')act({type:'done',id:current.id});
        if(e.key==='n')act({type:'skip',id:current.id});
        if(e.key==='f')act({type:'flag',id:current.id});
        if(e.key==='e'||e.key==='d')openTask(current,e.key==='d'?'details':'title');
      }
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const captureTask=async e=>{e.preventDefault();if(!draft.trim())return;const ok=await act({type:'add',id:newId(),title:draft,kind});if(ok){setDraft('');capture.current?.focus();}};
  const choose=async winner=>{
    if(choosing.current)return;
    choosing.current=true;
    const challenger=round.challengers[round.index];
    const final=round.index+1===round.total;
    const ok=await act({type:'shuffleChoice',ids:[round.champion.id,challenger.id],id:winner.id,final},{quiet:!final,undo:final});
    if(ok){if(final){setRound(null);setView('now');}else setRound({...round,champion:winner,index:round.index+1});}
    choosing.current=false;
  };
  const download=()=>{
    const content=state || (()=>{try{return JSON.parse(localStorage.getItem('now:state:v2'));}catch{return null;}})();
    if(!content){setImportError('There is no readable backup available.');return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`now-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const readImport=async e=>{const selected=e.target.files?.[0];e.target.value='';if(!selected)return;try{if(selected.size>20*1024*1024)throw Error('Choose a backup smaller than 20 MB.');setImportState(normalize(JSON.parse(await selected.text())));setImportError('');}catch(err){setImportState(null);setImportError(err instanceof SyntaxError?'That file is not valid JSON. Nothing was imported.':err.message);}};
  if(!state)return <div className="loading-screen"><span className="wordmark">To-Do</span><p>{error || 'Opening your desk…'}</p>{error&&<div className="button-row"><button onClick={retry}>Retry</button><button onClick={download}>Download old backup</button></div>}{importError&&<p>{importError}</p>}</div>;
  if(hidden)return <div className="curtain"><span className="wordmark">To-Do</span><p>A little space.</p><button onClick={()=>setHidden(false)}>Return to your desk<Icon name="arrow"/></button><small>Screen hidden. This is not a security lock.</small></div>;
  const tasks=mine(state);
  const waiting=waits(state).sort((a,b)=>dueAt(a)-dueAt(b));
  const quiet=waiting.filter(t=>dueAt(t)<=clock);
  const deck=state.deck.map(id=>state.tasks.find(t=>t.id===id)).filter(Boolean);
  const rest=tasks.filter(t=>t.id!==current?.id&&!state.deck.includes(t.id)).sort((a,b)=>state.flagged.includes(b.id)-state.flagged.includes(a.id)||a.createdAt-b.createdAt);
  const stale=current && clock-state.nowSetAt>=STALE_MS;
  const remaining=Math.max(0,Math.ceil((STALE_MS-(clock-state.nowSetAt))/60000));
  const archived=state.tasks.filter(t=>t.done||t.deletedAt).sort((a,b)=>(b.deletedAt||b.completedAt||0)-(a.deletedAt||a.completedAt||0));
  const list=(view==='waiting'?waiting:view==='history'?archived:tasks).filter(t=>`${t.title} ${t.who} ${(t.details||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const navigate=next=>{setView(next);setQuery('');setRound(null);};
  const row=(t,compact=false)=><div className={`task-row ${compact?'compact':''}`} key={t.id}>
    <button className="task-main" onClick={()=>openTask(t)}><span className="task-row-title">{state.flagged.includes(t.id)&&<Icon name="flag" size={14}/>}<span>{t.title}</span></span><span className="task-meta">{t.kind==='wait'?<><span>{t.who || 'Unassigned'}</span><span className={dueAt(t)<=clock?'due':''}>{dueLabel(t,clock)}</span></>:<>{t.id===current?.id?<span className="accent">Now</span>:state.deck.includes(t.id)?<span>On deck</span>:null}{t.details.length>0&&<span>{t.details.length} note{t.details.length===1?'':'s'}</span>}{(t.done||t.deletedAt)&&<span>{t.deletedAt?'In trash':'Completed'}{(t.deletedAt||t.completedAt)?` · ${new Date(t.deletedAt||t.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}</span>}</>}</span></button>
    {t.done||t.deletedAt?<button className="text-button" onClick={()=>act({type:'restore',id:t.id})} disabled={busy}>Restore</button>:compact?<button className="icon-button row-up" title="Make this now" aria-label={`Make ${t.title} now`} onClick={()=>act({type:'now',id:t.id})} disabled={busy}><Icon name="arrow"/></button>:<button className="icon-button" aria-label={`Actions for ${t.title}`} onClick={()=>openTask(t)}><Icon name="more"/></button>}
  </div>;
  return <div className="app-shell" aria-busy={busy}>
    <header className="header"><button className="wordmark" onClick={()=>navigate('now')} aria-label="To-Do, home">To-Do</button><nav aria-label="Views"><button className={view==='now'?'selected':''} onClick={()=>navigate('now')}>Focus</button><button className={view==='list'?'selected':''} onClick={()=>navigate('list')}>Everything<span className="count">{tasks.length}</span></button><button className={`${view==='waiting'?'selected':''} ${quiet.length?'has-due':''}`} onClick={()=>navigate('waiting')}>Waiting on{waiting.length>0&&<span className="count">{waiting.length}</span>}</button></nav><div className="header-tools"><span className="today">{new Date(clock).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><button className="icon-button" onClick={()=>act({type:'theme',theme:state.theme==='light'?'dark':'light'},{quiet:true,undo:false})} aria-label={state.theme==='light'?'Switch to dark mode':'Switch to light mode'}><Icon name={state.theme==='light'?'moon':'sun'}/></button><button className="icon-button" onClick={()=>setTools(true)} aria-label="Desk settings and backup"><Icon name="more"/></button></div></header>
    {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={retry}>Retry</button><button onClick={download}>Export saved tasks</button></div>}
    <main>
      {view==='now'?<>
        <h1 className="sr-only">Focus</h1>
        <div className="focus-grid"><section className="focus-column" aria-label="Current task">
          <div className="focus-card"><div className="card-top"><span className="eyebrow"><span className="tiny-line"/>Now</span>{current&&<button className={`text-button flag-button ${state.flagged.includes(current.id)?'is-flagged':''}`} onClick={()=>act({type:'flag',id:current.id})} disabled={busy}><Icon name="flag" size={16}/>{state.flagged.includes(current.id)?'Flagged':'Flag'}</button>}</div>
            {current?<><button className="focus-title" onClick={()=>openTask(current,'title')}>{current.title}</button><div className="focus-notes">{current.details.map((note,i)=><button onClick={()=>openTask(current,'details')} key={i}><span className="note-mark"/>{note}</button>)}<button className="add-note" onClick={()=>openTask(current,'details')}><Icon name="plus" size={14}/>{current.details.length?'Edit notes':'Add a useful detail'}</button></div><div className="card-bottom"><p className="reason">{state.nowReason || 'A good place to begin.'}</p><div className="card-actions"><button className="primary done-button" onClick={()=>act({type:'done',id:current.id})} disabled={busy}><Icon name="check"/>Done<span className="key-hint">X</span></button><button onClick={()=>act({type:'skip',id:current.id})} disabled={busy}>Not this<span className="key-hint">N</span></button><button className="text-button handoff" onClick={async()=>{if(await act({type:'handoff',id:current.id}))navigate('waiting');}} disabled={busy}>Hand it off<Icon name="arrow" size={16}/></button></div></div></>:<div className="empty-focus"><h2>{archived.length?'Room to breathe.':'What’s on your mind?'}</h2><p>{waiting.length?'Your work is clear. There are still a few things you’re waiting on.':'Capture the next thing below. It doesn’t need to be perfectly worded.'}</p><button className="text-button" onClick={()=>capture.current?.focus()}>Capture a task<Icon name="arrow"/></button></div>}
          </div>
          {current&&<div className={`focus-foot ${stale?'stale':''}`}><span><Icon name="clock" size={14}/>{stale?'Still the right thing?':`${remaining} min before a gentle check-in`}</span>{stale?<button className="text-button" onClick={()=>act({type:'renew'})}>Still working<Icon name="check" size={14}/></button>:<span className="muted">No rush. Just focus.</span>}</div>}
          {tasks.filter(t=>!state.deck.includes(t.id)).length>1&&<div className="shuffle-invite"><div><span>Not sure where to start?</span><small>A few choices can clear the fog.</small></div><button onClick={startShuffle}><Icon name="shuffle"/>Shuffle<span className="key-hint">S</span></button></div>}
        </section><aside className="rail"><section className="deck-section"><div className="section-title"><h2>On deck</h2><span>{deck.length} / 2</span></div>{[0,1].map(i=><div className={`deck-slot ${deck[i]?'filled':''}`} key={i}><span className="deck-index">0{i+1}</span>{deck[i]?<><button className="deck-title" onClick={()=>openTask(deck[i])}>{deck[i].title}</button><button className="icon-button" aria-label={`Make ${deck[i].title} now`} onClick={()=>act({type:'now',id:deck[i].id})}><Icon name="arrow" size={17}/></button></>:<button className="deck-empty" onClick={()=>navigate('list')}>{i===0?'Leave room for what’s next.':'And one after that.'}</button>}</div>)}</section>
          {quiet.length>0&&<button className="waiting-callout" onClick={()=>navigate('waiting')}><span className="eyebrow">A loose end</span><strong>{quiet.length} thing{quiet.length===1?' needs':'s need'} a nudge.</strong><span>Check waiting on<Icon name="arrow" size={15}/></span></button>}
          <section className="periphery"><div className="section-title"><h2>In the periphery</h2>{rest.length>0&&<span>{rest.length}</span>}</div>{rest.length?rest.slice(0,5).map(t=>row(t,true)):<p className="rail-empty">Nothing else competing for your attention.</p>}{rest.length>5&&<button className="text-button more-tasks" onClick={()=>navigate('list')}>See {rest.length-5} more<Icon name="arrow" size={15}/></button>}</section>
        </aside></div>
      </>:<section className="list-surface"><div className="list-heading"><div><span className="eyebrow">{view==='waiting'?'Keep the loop closed':view==='history'?'Nothing lost':'The whole picture'}</span><h1>{view==='waiting'?'Waiting on.':view==='history'?'History.':'Everything.'}</h1></div><span className="list-total">{view==='waiting'?waiting.length:view==='history'?archived.length:tasks.length} items</span></div><label className="search"><Icon name="search"/><input placeholder={view==='waiting'?'Find a task or a person…':'Find a task or a note…'} aria-label="Search tasks" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><Icon name="close" size={16}/></button>}</label>
        {view==='waiting'&&quiet.length>0&&<p className="list-note">{quiet.length} ready for a check-in. Soonest follow-ups come first.</p>}
        {list.length?list.map(t=>row(t)):<div className="list-empty"><h2>{query?'Nothing matches that.':view==='waiting'?'No loose ends here.':view==='history'?'A clean slate.':'A little breathing room.'}</h2><p>{query?'Try a different word.':view==='history'?'Completed tasks and anything you drop will stay here, ready to restore.':'Capture a task below whenever you’re ready.'}</p></div>}
      </section>}
    </main>
    <footer className="capture-dock"><form className="capture-form" onSubmit={captureTask}><label className="capture-kind"><span className="sr-only">Task type</span><select aria-label="Task type" value={kind} onChange={e=>setKind(e.target.value)}><option value="do">Mine</option><option value="wait">Waiting on</option></select></label><input ref={capture} aria-label="Capture a task" placeholder={kind==='wait'?'What, and @who has it?':'Get it out of your head…'} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={500} onKeyDown={e=>{if(e.key==='Escape')e.currentTarget.blur();}}/><button className="capture-add" disabled={busy||!draft.trim()} aria-label="Add task"><Icon name="plus"/></button></form><div className="desk-footer"><span>{busy?'Saving…':error?'Save needs attention':'Saved on this device'}</span><button className="text-button" onClick={()=>setTools(true)}>Shortcuts & backup</button></div></footer>
    {toast&&<div className="toast" role="status"><span>{toast.message}</span>{toast.undo&&<button disabled={busy} onClick={async()=>{const undo=toast.undo;setToast(null);await act(undo,{undo:false});}}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast(null)}><Icon name="close" size={15}/></button></div>}
    {editor&&<TaskEditor task={editor.task} state={state} act={act} onClose={()=>setEditor(null)} initialFocus={editor.focus}/>}
    {round&&<Modal title="Which matters more right now?" wide onClose={()=>setRound(null)}><p className="shuffle-description">Pick the one you’d rather move forward. This round decides.</p>{error&&<p role="alert" className="form-error">{error}</p>}<div className="shuffle-choices">{[round.champion,round.challengers[round.index]].map((t,i)=><button key={t.id} disabled={busy} onClick={()=>choose(t)}><span className="eyebrow">Choose {i+1}</span><strong>{t.title}</strong><span className="choice-bottom">This one<Icon name="arrow"/></span></button>)}</div><div className="shuffle-progress"><span>Choice {round.index+1} of {round.total}</span><div>{Array.from({length:round.total},(_,i)=><span key={i} className={i<=round.index?'on':''}/>)}</div><button className="text-button" onClick={()=>setRound(null)}>Leave shuffle</button></div></Modal>}
    {tools&&<Modal title="Your desk" onClose={()=>{setTools(false);setImportState(null);setImportError('');}}><div className="tools-content"><section><h3>Keep a copy.</h3><p>Tasks stay in this browser. Download a backup to keep a spare or bring them to another device.</p><div className="button-row"><button onClick={download}><Icon name="download" size={16}/>Export backup</button><button onClick={()=>file.current?.click()}>Import backup</button></div><input ref={file} type="file" accept=".json,application/json" hidden onChange={readImport}/>{importError&&<p role="alert" className="form-error">{importError}</p>}{importState&&<div className="import-preview"><strong>{importState.tasks.length} tasks in this backup</strong><p>New task IDs will be added. Tasks already here are kept as they are.</p><button className="primary" disabled={busy} onClick={async()=>{if(await act({type:'import',state:importState})){setImportState(null);setTools(false);}}}>Import new tasks</button></div>}</section><section><h3>Look back. Or step away.</h3><div className="button-row"><button onClick={()=>{setTools(false);navigate('history');}}>Completed & trash</button><button onClick={()=>{setTools(false);setHidden(true);}}>Hide screen</button>{hasPassphrase&&<button onClick={onLock}>Lock with passphrase</button>}</div><p className="small">Hide screen is a privacy curtain, not a security lock.</p></section><section><h3>Keep your hands on the keys.</h3><div className="shortcuts">{[['/','Capture'],['S','Shuffle'],['X','Done'],['N','Not this'],['F','Flag'],['E','Edit task'],['D','Notes'],['W','Waiting on'],['Esc','Back to focus']].map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div></section><p className="tools-note">Check-in reminders appear while To-Do is open. Your original version’s saved copy is preserved when tasks are brought over.</p></div></Modal>}
  </div>;
}
