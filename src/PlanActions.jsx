import React,{useState} from 'react';
import {dayKey} from './model';
export default function PlanActions({task,act,disabled,onClose}){
 const [date,setDate]=useState(task.reviewDate||'');
 if(task.kind!=='do'||task.done||task.deletedAt)return null;
 const plan=async destination=>{if(await act({type:'plan',id:task.id,destination,reviewDate:date}))onClose();};
 return <section className="plan-actions"><h3>Decide when, then let it go.</h3><p>{task.planDate===dayKey()?'Selected for today.':task.inbox?'In Inbox, awaiting a decision.':'In your full task list.'}</p><label>Review on (optional)<input type="date" value={date} disabled={disabled} onChange={e=>setDate(e.target.value)}/></label><div className="button-row"><button disabled={disabled} onClick={()=>plan('today')}>Do today</button><button disabled={disabled} onClick={()=>plan('later')}>Save for later</button><button disabled={disabled} onClick={()=>plan('inbox')}>Back to Inbox</button></div><p>Save for later removes it from Today. A review date brings it to Review that morning. Without a date, it stays in All tasks for your weekly review.</p></section>;
}
