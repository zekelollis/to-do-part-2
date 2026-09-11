export const DAY = 86400000;
export const STALE_MS = 90 * 60000;
export const DECK_MAX = 2;
export const FLAG_MAX = 5;
export const DETAIL_MAX = 5;
export const DETAIL_LEN = 120;
export const active = t => !t.done && !t.deletedAt;
export const mine = s => s.tasks.filter(t => active(t) && t.kind === 'do');
export const waits = s => s.tasks.filter(t => active(t) && t.kind === 'wait');
export const dueAt = t => (t.since || t.createdAt) + (t.checkDays || 2) * DAY;
export const emptyState = () => ({v:3, revision:0, tasks:[], deck:[], flagged:[], nowId:null, nowSetAt:0, nowReason:'', theme:'light'});
export const newId = () => crypto.randomUUID();

export function parseWho(raw) {
  // Only a standalone @name token is an owner; never consume an email.
  const match = raw.match(/(?:^|\s)@([\p{L}\p{N}_.'-]+)(?=\s|$)/u);
  return match ? {title:raw.replace(match[0], ' ').replace(/\s+/g,' ').trim(), who:match[1]} : {title:raw.trim(), who:''};
}


export function normalize(input) {
  if (!input || !Array.isArray(input.tasks) || ![2,3].includes(input.v)) throw Error('This is not a supported Now backup. Choose a version 2 or 3 backup.');
  if (input.tasks.length > 20000) throw Error('This backup is too large.');
  const seen = new Set();
  const tasks = input.tasks.map(t => {
    if (!t || typeof t.id !== 'string' || !t.id || seen.has(t.id) || typeof t.title !== 'string' || !t.title.trim() || !['do','wait'].includes(t.kind)) throw Error('The backup contains an invalid or duplicate task. Nothing was imported.');
    if (t.details != null && (!Array.isArray(t.details) || t.details.some(x=>typeof x !== 'string'))) throw Error('The backup contains invalid notes. Nothing was imported.');
    seen.add(t.id);
    return {...t, title:t.title.trim(), details:t.details || [], who:typeof t.who === 'string' ? t.who : '', createdAt:Number.isFinite(t.createdAt) ? t.createdAt : Date.now(), since:Number.isFinite(t.since) ? t.since : Date.now(), checkDays:[1,2,3,7].includes(t.checkDays) ? t.checkDays : 2, done:!!t.done, deletedAt:Number.isFinite(t.deletedAt) ? t.deletedAt : null, lastComparedAt:Number.isFinite(t.lastComparedAt) ? t.lastComparedAt : 0};
  });
  return clean({...emptyState(), ...input, v:3, tasks, revision:Number.isSafeInteger(input.revision) ? input.revision : 0, theme:'light', deck:Array.isArray(input.deck) ? input.deck : [], flagged:Array.isArray(input.flagged) ? input.flagged : []});
}

function clean(s) {
  const live = new Set(mine(s).map(t=>t.id));
  s.deck = [...new Set(s.deck)].filter(id=>live.has(id) && id !== s.nowId).slice(-DECK_MAX);
  s.flagged = [...new Set(s.flagged)].filter(id=>live.has(id)).slice(-FLAG_MAX);
  if (!live.has(s.nowId)) {
    s.nowId = s.deck.shift() || mine(s)[0]?.id || null;
    s.nowSetAt = Date.now();
    s.nowReason = s.nowId ? 'Next one up.' : '';
  }
  return s;
}

export function applyAction(previous, action, now = Date.now()) {
  let s = structuredClone(previous);
  const t = s.tasks.find(x=>x.id === action.id);
  const update = fields => { if (!t) throw Error('That task changed in another tab. Please try again.'); Object.assign(t, fields); };
  let message = 'Saved';
  switch(action.type) {
    case 'add': {
      const parsed = action.kind === 'wait' ? parseWho(action.title) : {title:action.title.trim(),who:''};
      if (!parsed.title) throw Error('Give the task a title.');
      const details=action.details ?? [];
      if (!Array.isArray(details)||details.length>DETAIL_MAX||details.some(x=>typeof x!=='string'||x.length>DETAIL_LEN)) throw Error('Keep notes to five lines, 120 characters each.');
      s.tasks.push({id:action.id, ...parsed, who:action.kind==='wait' ? (action.who?.trim() || parsed.who) : '', kind:action.kind, details:details.map(x=>x.trim()).filter(Boolean), createdAt:now, since:now, checkDays:action.checkDays || 2, done:false, lastComparedAt:0});
      message = action.kind === 'wait' ? 'Added to waiting on' : 'Task captured'; break;
    }
    case 'edit': {
      if (action.expectedTask && JSON.stringify(t)!==action.expectedTask) throw Error('This task changed in another tab. Reopen it before editing so those changes are kept.');
      if (!action.title.trim()) throw Error('Give the task a title.');
      if (action.details.length > DETAIL_MAX || action.details.some(x=>x.length > DETAIL_LEN)) throw Error('Keep notes to five lines, 120 characters each.');
      update({title:action.title.trim(), who:action.who.trim(), details:action.details.map(x=>x.trim()).filter(Boolean), checkDays:action.checkDays}); message='Changes saved'; break;
    }
    case 'done': update({done:true, completedAt:now}); message=t.kind === 'wait' ? 'Landed. One less loose end.' : 'Done. Nicely handled.'; break;
    case 'drop': update({deletedAt:now}); message='Moved to trash'; break;
    case 'restore': update({done:false,deletedAt:null,completedAt:null}); message='Task restored'; break;
    case 'now':
      if (!t || !active(t) || t.kind !== 'do') throw Error('That task is no longer available.');
      s.nowId=t.id; s.nowSetAt=now; s.nowReason=action.reason || 'You chose this.'; message='Now is set'; break;
    case 'renew': s.nowSetAt=now; s.nowReason='Still the right thing. Keep going.'; message='Another 90 minutes, on your terms'; break;
    case 'skip': {
      const next = s.deck.find(id=>id!==s.nowId) || mine(s).filter(x=>x.id!==s.nowId).sort((a,b)=>(a.lastSkippedAt||0)-(b.lastSkippedAt||0))[0]?.id;
      if (t) t.lastSkippedAt=now;
      if (next) {s.nowId=next; s.nowSetAt=now; s.nowReason='A fresh place to start.'; message='Set aside for now';}
      else {s.nowSetAt=now; message='This is the only task in your pile';} break;
    }
    case 'deck':
      if (!t || !active(t) || t.kind !== 'do' || t.id===s.nowId) throw Error('Choose another active task for the deck.');
      if(s.deck.includes(t.id)) {s.deck=s.deck.filter(id=>id!==t.id); message='Taken off deck';}
      else {s.deck.push(t.id); if(s.deck.length>DECK_MAX) {const displaced=s.deck.shift(); const old=s.tasks.find(x=>x.id===displaced); message=`On deck. “${old?.title}” returned to the pile.`;} else message='Added to the deck';} break;
    case 'flag':
      if (!t || !active(t) || t.kind !== 'do') throw Error('Only your active tasks can be flagged.');
      if(s.flagged.includes(t.id)) {s.flagged=s.flagged.filter(id=>id!==t.id); message='Flag removed';}
      else {s.flagged.push(t.id); if(s.flagged.length>FLAG_MAX) {const displaced=s.flagged.shift(); const old=s.tasks.find(x=>x.id===displaced); message=`Flagged. The flag on “${old?.title}” was cleared.`;} else message='Flagged for your attention';} break;
    case 'handoff': {const p=parseWho(t?.title || ''); update({kind:'wait',title:p.title || t.title,who:p.who || t.who,since:now}); message='Moved to waiting on'; break;}
    case 'takeback': update({kind:'do',lastComparedAt:0}); message='Back in your pile'; break;
    case 'nudge': update({since:now}); message=`Check back in ${t.checkDays} day${t.checkDays===1?'':'s'}`; break;
    case 'shuffleChoice': {
      if (!t || !active(t) || t.kind !== 'do' || action.ids.some(id=>!s.tasks.some(x=>x.id===id && active(x) && x.kind==='do'))) throw Error('A task in this shuffle changed. Close shuffle and start a fresh round.');
      for (const id of action.ids) s.tasks.find(x=>x.id===id).lastComparedAt=now;
      if (action.final) {s.nowId=t.id;s.nowSetAt=now;s.nowReason='Your pick from a fresh round.';message='A clear next step';}
      break;
    }
    case 'compared': {
      for (const id of action.ids) {const item=s.tasks.find(x=>x.id===id); if(item) item.lastComparedAt=now;}
      break;
    }
    case 'theme': s.theme='light'; break;
    case 'import': {
      const incoming=normalize(action.state);
      const existing=new Set(s.tasks.map(x=>x.id));
      const additions=incoming.tasks.filter(x=>!existing.has(x.id));
      if (!s.tasks.length) {s={...incoming,revision:s.revision};} else s.tasks.push(...additions);
      message=`Imported ${additions.length} task${additions.length===1?'':'s'}. Existing tasks were kept.`; break;
    }
    default: throw Error('Unknown action.');
  }
  s = clean(s);
  s.revision = previous.revision+1;
  s.updatedAt=now;
  return {state:normalize(s),message};
}

export function shuffleCandidates(s) {
  const pool=mine(s).filter(t=>!s.deck.includes(t.id));
  const current=pool.find(t=>t.id===s.nowId);
  // Oldest-seen first: every task can enter. At most five decisions.
  const rest=pool.filter(t=>t.id!==current?.id).sort((a,b)=>(a.lastComparedAt||0)-(b.lastComparedAt||0) || (s.flagged.includes(b.id)-s.flagged.includes(a.id)) || a.createdAt-b.createdAt);
  return (current ? [current,...rest] : rest).slice(0,6);
}
