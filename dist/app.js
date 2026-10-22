import { signals, initialMembers, venues } from './fixtures.js';
import { negotiate, applyFeedback } from './engine.js';
import { previewInstruction } from './instructions.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const freshState = () => ({ members: structuredClone(initialMembers), constraints: { area:'all', maxDistanceKm:5, maxPriceLevel:3 } });
let state = freshState(), result, round = 0, dirty = false, events = [], undoStack = [], nextMember = 5;
let mode = 'demo', busy = false, apiError = '', userInteracted = false;
let instructionPreview = null;
let votes = {};
const isLive = () => mode === 'qloo';
const emptyResult = () => ({ error:null, plans:[], eligible:[], excluded:[], totalCandidates:0 });
let feedbackSelection = { memberId:'m3', type:'reject', venueId:'v1' }, toastTimeout;
const strategies = { balanced:['Everyone considered','Prioritize the least-matched person'], overall:['Highest-average alternative','Highest average among remaining candidates'], discovery:['A little discovery','Less popular, with every percentile at least 60'] };
const signalName = id => signals.find(s=>s.id===id)?.name || id;
const rounded = n => Math.round(n);
function notify(text){ $('toast').textContent=text; $('toast').hidden=false; clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>$('toast').hidden=true,4000); }
function selected(value, current){ return value === current ? ' selected' : ''; }
function renderMembers(){
  $('member-count').textContent=`${state.members.length}/4 people`;
  $('add-member').disabled=state.members.length>=4;
  $('members').innerHTML=state.members.map((m,i)=>`<div class="member-card"><div class="member-top"><span class="avatar" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><input data-member="${m.id}" data-field="name" value="${escape(m.name)}" maxlength="16" aria-label="Person ${i+1} name"><button class="remove-button" data-remove="${m.id}" ${state.members.length<=2?'disabled':''} aria-label="Remove ${escape(m.name)}">×</button></div><div class="taste-selects">${m.signals.map((id,index)=>`<select data-member="${m.id}" data-field="signal" data-index="${index}" aria-label="${escape(m.name)} taste ${index+1}">${signals.map(s=>`<option value="${s.id}"${selected(s.id,id)}>${escape(s.name)} · ${s.domain}</option>`).join('')}</select>`).join('')}</div><label class="check-label"><input type="checkbox" data-member="${m.id}" data-field="no-bars"${m.exclusions.includes('bar')?' checked':''}>Avoid bars</label>${m.rejectedIds.length?`<p class="rejection-note">${m.rejectedIds.length} venues rejected</p>`:''}</div>`).join('');
}
function renderConstraints(){
  const c=state.constraints;
  $('constraints').innerHTML=`<label class="field">Neighborhood<select data-constraint="area">${[['all',isLive()?'NYC · near meeting point':'NYC · all demo neighborhoods'],['East Village','East Village'],['SoHo','SoHo'],['Chelsea','Chelsea']].map(([id,name])=>`<option value="${id}"${selected(id,c.area)}>${name}</option>`).join('')}</select></label><div class="field-row"><label class="field">Maximum distance<select data-constraint="maxDistanceKm">${Array.from({length:10},(_,i)=>i+1).map(v=>`<option value="${v}"${selected(v,c.maxDistanceKm)}>${v} km</option>`).join('')}</select></label><label class="field">Maximum price tier<select data-constraint="maxPriceLevel">${[1,2,3,4].map(v=>`<option value="${v}"${selected(v,c.maxPriceLevel)}>${'$'.repeat(v)} · ${['Budget','Moderate','Upscale','Premium'][v-1]}</option>`).join('')}</select></label></div>`;
}
function rationale(plan){
  const low=plan.memberScores.reduce((a,b)=>a.score<=b.score?a:b);
  if(isLive()){
    const score=rounded(low.score);
    const prefix=plan.strategy==='balanced'?`Maximize the lowest member percentile, then the average. ${escape(low.name)} has a percentile of  <strong>${score}</strong>.`:plan.strategy==='overall'?`The highest average among remaining candidates is  <strong>${rounded(plan.average)}</strong> · ${escape(low.name)} is at ${score}. Ask whether this tradeoff works.`:`Lower Qloo popularity, with every member at or above the 60th percentile.`;
    return `${prefix} Percentiles rank this shared candidate pool; they do not predict satisfaction.`;
  }
  const best=low.evidence.reduce((a,b)=>a.score>=b.score?a:b);
  if(plan.strategy==='balanced') return `The lowest match is  <strong>${escape(low.name)}</strong> at  <strong>${rounded(low.score)}</strong>. This venue ranks first when we prioritize the lowest member score, then the average.`;
  if(plan.strategy==='overall') return `Group average <strong>${rounded(plan.average)}</strong>, while  <strong>${escape(low.name)}</strong> is at  ${rounded(low.score)}. Ask them whether this tradeoff works.`;
  return `Lower illustrative popularity and every member scores at least 60. The largest contribution for ${escape(low.name)} is <strong>${escape(signalName(best.signalId))}</strong>.`;
}
function renderResults(){
  $('round-badge').textContent=`Round ${round}`;
  $('stale-banner').hidden=!dirty;
  $('negotiate').textContent=busy?'Consulting Qloo…':round===0?'Find real venues':dirty?'Replan with new settings':'Find common ground again';
  $('request-status').hidden=!busy;
  $('request-error').hidden=!apiError;
  $('request-error').textContent=apiError+(apiError && round>0?' Previous results and settings have been preserved.':'');
  $('result-summary').textContent=result.error || `${result.totalCandidates ?? venues.length} ${isLive()?'Qloo candidates':'demo venues'} · ${result.eligible.length} eligible · ${result.excluded.length} excluded`;
  if(!result.plans.length){
    $('results').innerHTML=`<div class="empty-state"><h3>${round===0 && isLive()?'Ready to find your common ground.':result.error?'Complete your group details':'No shared option under these boundaries.'}</h3><p>${escape(round===0 && isLive()?'Set individual tastes and shared boundaries, then find real venues powered by Qloo.':result.error || 'Every boundary has been preserved. Discuss a change together, then try again.')}</p>${!result.error && round>0?'<ul><li>Consider a wider radius or all neighborhoods.</li><li>Agree together on a higher price tier.</li><li>Undo feedback or reset the group to restore rejected venues.</li></ul>':''}</div>`;
  } else {
    $('results').innerHTML=`<div class="plans plan-count-${result.plans.length}">${result.plans.map(p=>`<article class="plan-card ${p.strategy}"><div class="plan-type">${isLive() && p.strategy==='overall'?'Highest-average alternative':strategies[p.strategy][0]}</div><div class="plan-body"><p class="venue-kind">${escape(p.venue.label)} · ${isLive()?'Qloo venue':'fictional venue'}</p><h3>${escape(p.venue.name)}</h3><p class="venue-meta">${escape(p.venue.area)}<br>${isLive()?p.venue.distanceKm.toFixed(1):p.venue.distanceKm} km · ${'$'.repeat(p.venue.priceLevel)} price tier</p><p class="venue-description">${escape(p.venue.description)}</p>${isLive()?`<p class="venue-address">${escape(p.venue.address)}</p>`:''}<div class="floor-score"><span>${isLive()?'Lowest member percentile':'Lowest illustrative match'}</span><strong>${rounded(p.floor)}<small>/100</small></strong></div><div class="score-list">${p.memberScores.map(m=>`<div class="score-row ${m.score===p.floor?'lowest':''}" title="${escape(isLive()?`Raw Qloo affinity ${m.rawAffinity.toFixed(4)} · Candidate percentile ${rounded(m.score)} · ${m.evidence.length?m.evidence.map(e=>`${signalName(e.signalId)} contribution ${e.score.toFixed(3)}`).join(' · '):'No taste-contribution detail returned'}`:m.evidence.map(e=>`${signalName(e.signalId)}: ${e.score} illustrative points`).join(' · '))}"><span class="score-name">${escape(m.name)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:${m.score}%"></span></span><span class="score-value">${rounded(m.score)}</span></div>`).join('')}</div><div class="average-line"><span>${isLive()?'Average percentile':'Group average'}</span><strong>${rounded(p.average)}</strong></div><p class="plan-rationale">${rationale(p)}</p>${isLive()?`<details class="evidence-detail"><summary>Inspect individual evidence</summary>${p.memberScores.map(m=>`<p><strong>${escape(m.name)}</strong>: Qloo affinity ${m.rawAffinity.toFixed(4)} · percentile ${rounded(m.score)}.${m.evidence.length?escape(m.evidence.map(e=>`${signalName(e.signalId)} contribution ${e.score.toFixed(3)}`).join(', ')):'No taste-contribution detail returned.'}</p>`).join('')}</details>`:''}<button class="object-button" data-object="${p.venue.id}"${dirty || busy?' disabled':''}>Discuss this option</button></div></article>`).join('')}</div>${result.plans.length<3?`<p class="limited-note">Showing  ${result.plans.length} distinct options. Discovery requires every member’s ${isLive()?'percentile':'illustrative match'} to reach 60 and known popularity data.</p>`:''}`;
  }
  $('audit-summary').textContent=`Inspect filtering · ${result.excluded.length} venues excluded`;
  $('audit-content').innerHTML=`${isLive() && result.metadata?`<p class="score-method">This round uses ${result.metadata.scoredCandidates} fully scored candidates. Percentiles change with the pool and cannot be compared across rounds.${escape(result.metadata.notices.join(' '))}</p>`:''}<div class="audit-grid">${[...result.eligible,...result.excluded].map(p=>`<div class="audit-item"><strong>${escape(p.venue.name)}</strong><p>${p.blocked.length?escape(p.blocked.join(' · ')):`Within shared boundaries · lowest ${rounded(p.floor)} / mean ${rounded(p.average)} ${isLive()?'percentile':'illustrative points'}`}</p></div>`).join('')}</div>`;
}
function renderFeedback(){
  if(!state.members.some(m=>m.id===feedbackSelection.memberId)) feedbackSelection.memberId=state.members[0].id;
  if(!result.plans.some(p=>p.venue.id===feedbackSelection.venueId)) feedbackSelection.venueId=result.plans[0]?.venue.id || '';
  $('feedback-fields').innerHTML=`<div class="field-row"><label class="field">Who wants a change?<select name="memberId">${state.members.map(m=>`<option value="${m.id}"${selected(m.id,feedbackSelection.memberId)}>${escape(m.name)}</option>`).join('')}</select></label><label class="field">What should change?<select name="type">${[['reject','Reject this venue'],['no-bars','Avoid all bars'],['closer','Reduce radius by 1 km'],['cheaper','Lower price by one tier']].map(([id,name])=>`<option value="${id}"${selected(id,feedbackSelection.type)}>${name}</option>`).join('')}</select></label></div><label class="field"${feedbackSelection.type!=='reject'?' hidden':''}>Which option?<select name="venueId"${!result.plans.length?' disabled':''}>${result.plans.length?result.plans.map(p=>`<option value="${p.venue.id}"${selected(p.venue.id,feedbackSelection.venueId)}>${escape(p.venue.name)}</option>`).join(''):'<option value="">No option available</option>'}</select></label>`;
  $('feedback-form').querySelector('[type=submit]').disabled=busy || dirty || round===0 || (feedbackSelection.type==='reject' && !result.plans.length);
  $('undo').hidden=!undoStack.length;
}
function renderTrace(){
  $('trace').innerHTML=[...events].reverse().map(e=>`<li class="trace-item"><p class="trace-round">Round ${e.round} · ${e.kind}</p><p class="trace-title">${escape(e.title)}</p><p class="trace-detail">${escape(e.detail)}</p></li>`).join('');
}
function render(){ renderMembers(); renderConstraints(); renderResults(); renderFeedback(); renderTrace(); renderSource(); renderAgreement(); renderTradeoff(); for(const id of ['reset','negotiate','data-mode','undo'])$(id).disabled=busy; if(busy) document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true); }
function renderSource(){
  $('data-mode').value=mode;
  $('source-badge').textContent=isLive()?'Qloo connected':'Illustrative demo';
  $('city-note').textContent=isLive()?'Meeting point · Union Square':'Illustrative city and fictional venues';
  $('distance-note').textContent=isLive()?'Straight-line distance from Union Square, not walking time.':'Distances use one illustrative meeting point.';
  $('source-note').innerHTML=isLive()?'<strong>Live Qloo data</strong><span>Individual tastes. One shared candidate pool. Percentiles show relative rank, not predicted satisfaction. Verify hours and menus before visiting.</span>':'<strong>Illustrative demo</strong><span>Fictional venues and authored scores. No Qloo or model requests. Scores do not predict satisfaction.</span>';
}
function clearDecision(){ votes={};instructionPreview=null;$('instruction-preview').hidden=true; }
function markDirty(){ userInteracted=true; dirty=true; undoStack=[];clearDecision(); render(); }
async function run(title='Find options for the current group',kind='Plan generated', nextState=state){
  if(busy)return false;
  const previous=result?.plans[0]?.venue.name;
  apiError='';busy=isLive();render();
  let nextResult;
  try{
    if(isLive()){
      const response=await fetch('/api/negotiate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(nextState),signal:AbortSignal.timeout(120000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Qloo is unavailable. Please retry.');
      nextResult=data;
    }else nextResult=negotiate(nextState,venues);
    state=nextState;result=nextResult;round++;dirty=false;clearDecision();
    const current=result.plans[0]?.venue.name;
    const outcome=current?(previous && previous!==current?`The leading option changed from ${previous} to ${current}.`:`Leading option: ${current}.`):'No option meets all current boundaries.';
    events.push({round,kind,title,detail:`${outcome} ${result.eligible.length} eligible candidates. ${result.error || 'Distance, price, type and vetoes take priority over taste.'}`});
    return true;
  }catch(error){apiError=error.name==='TimeoutError'?'The request timed out. Please retry.':error.message;notify(apiError);return false;}
  finally{busy=false;render();}
}
$('members').addEventListener('input',()=>{userInteracted=true;});
$('members').addEventListener('change',event=>{
  const el=event.target,member=state.members.find(m=>m.id===el.dataset.member);if(!member)return;
  if(el.dataset.field==='name')member.name=el.value.trim();
  if(el.dataset.field==='signal'){
    const index=Number(el.dataset.index);
    if(member.signals.some((s,i)=>i!==index && s===el.value)){ notify('Choose two different tastes for this person.');renderMembers();return; }
    member.signals[index]=el.value;
  }
  if(el.dataset.field==='no-bars')member.exclusions=el.checked?['bar']:[];
  markDirty();
});
$('members').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button || state.members.length<=2)return;state.members=state.members.filter(m=>m.id!==button.dataset.remove);markDirty();});
$('add-member').addEventListener('click',()=>{if(state.members.length>=4)return;state.members.push({id:`m${nextMember++}`,name:`Person ${state.members.length+1}`,signals:['indie','design'],exclusions:[],rejectedIds:[]});markDirty();});
$('constraints').addEventListener('change',event=>{const field=event.target.dataset.constraint;if(!field)return;state.constraints[field]=field==='area'?event.target.value:Number(event.target.value);markDirty();});
$('negotiate').addEventListener('click',()=>{userInteracted=true;const validation=negotiate(state,venues).error;if(validation){notify(validation);return;}run();});
$('results').addEventListener('click',event=>{const button=event.target.closest('[data-object]');if(!button || dirty)return;feedbackSelection.type='reject';feedbackSelection.venueId=button.dataset.object;renderFeedback();$('feedback-form').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});$('feedback-form').elements.memberId.focus({preventScroll:true});});
$('feedback-form').addEventListener('change',event=>{if(!event.target.name)return;feedbackSelection[event.target.name]=event.target.value;if(event.target.name==='type')renderFeedback();});
$('feedback-form').addEventListener('submit',async event=>{
  event.preventDefault();userInteracted=true;if(dirty){notify('Generate fresh results before giving feedback.');return;}
  const feedback=Object.fromEntries(new FormData(event.currentTarget));
  const member=state.members.find(m=>m.id===feedback.memberId);
  const venue=(isLive()?[...result.eligible,...result.excluded].map(x=>x.venue):venues).find(v=>v.id===feedback.venueId);
  const titles={reject:`${member.name} rejects ${venue?.name || 'this venue'}`, 'no-bars':`${member.name} wants to avoid all bars`,closer:`${member.name} asks to reduce the shared radius by 1 km`,cheaper:`${member.name} asks to lower the shared price cap by one tier`};
  try{ const next=applyFeedback(state,feedback);const before=structuredClone(state);if(await run(titles[feedback.type],'Feedback applied',next)){undoStack.push(before);renderFeedback();notify('Other preferences preserved. Replanned with the new boundary.');} }catch(error){notify(error.message);}
});
$('undo').addEventListener('click',async()=>{if(!undoStack.length || busy)return;const next=undoStack.at(-1);if(await run('Undo feedback and restore previous boundaries','Feedback undone',next)){undoStack.pop();renderFeedback();notify('Previous boundaries restored.');}});
function reset(){
  clearDecision();
  state=freshState();round=0;events=[];undoStack=[];result=emptyResult();dirty=false;apiError='';nextMember=5;
  feedbackSelection={memberId:'m3',type:'reject',venueId:isLive()?'':'v1'};
  if(isLive())render();else run('Load four friends’ illustrative tastes','Start demo');
}
$('reset').addEventListener('click',()=>{if(!busy){userInteracted=true;reset();notify('Group and boundaries reset.');}});
$('data-mode').addEventListener('change',event=>{userInteracted=true;mode=event.target.value;reset();});
result=emptyResult();run('Load four friends’ illustrative tastes','Start demo');
fetch('/api/status').then(r=>r.ok?r.json():null).then(status=>{
  if(status?.qlooConfigured){$('data-mode').querySelector('[value=qloo]').disabled=false;if(!userInteracted){mode='qloo';reset();}}
}).catch(()=>{});

function renderAgreement(){
  const top=result.plans[0];
  $('agreement').hidden=!top || dirty;
  $('instruction-submit').disabled=busy || dirty || !round;
  $('instruction-apply').disabled=busy || !instructionPreview;
  if(!top)return;
  const all=state.members.every(m=>votes[m.id]===top.venue.id);
  $('agreement-title').textContent=all?'Everyone is on board.':'Does the leading option work for everyone?';
  $('agreement-copy').textContent=all?`${top.venue.name} is your shared choice. Check hours and availability before going.`:`${top.venue.name} · Ask each person before recording their agreement. Shared-screen session; no remote votes.`;
  $('agreement-votes').innerHTML=state.members.map(m=>`<button class="vote-button ${votes[m.id]===top.venue.id?'accepted':''}" data-vote="${m.id}"${busy?' disabled':''}>${escape(m.name)} · ${votes[m.id]===top.venue.id?'Agreed ✓':'Record agreement'}</button>`).join('');
  $('instruction-submit').disabled=busy || dirty || !round;
  $('instruction-apply').disabled=busy || !instructionPreview;
}
$('agreement-votes').addEventListener('click',event=>{
  const button=event.target.closest('[data-vote]');if(!button || busy || dirty)return;
  const id=button.dataset.vote;if(!state.members.some(m=>m.id===id) || !result.plans[0])return;
  votes[id]=votes[id]?undefined:result.plans[0].venue.id;renderAgreement();
});
$('instruction-form').addEventListener('submit',event=>{
  event.preventDefault();userInteracted=true;
  if(busy || dirty || !round){notify('Generate fresh options before previewing feedback.');return;}
  try{
    instructionPreview=previewInstruction(state,$('instruction-text').value,result.plans,feedbackSelection.memberId);
    $('instruction-diff').textContent=instructionPreview.actions.map(a=>a.description).join(' · ');
    $('instruction-preview').hidden=false;renderAgreement();
  }catch(error){instructionPreview=null;$('instruction-preview').hidden=true;notify(error.message);}
});
$('instruction-text').addEventListener('input',()=>{instructionPreview=null;$('instruction-preview').hidden=true;});
$('instruction-apply').addEventListener('click',async()=>{
  if(!instructionPreview || busy || dirty)return;
  const preview=instructionPreview,before=structuredClone(state);
  if(await run(preview.actions.map(a=>a.description).join(' · '),'Command feedback',preview.nextState)){
    undoStack.push(before);$('instruction-text').value='';renderFeedback();notify('Feedback applied. Every other boundary was preserved.');
  }
});

function renderTradeoff(){
  const top=result.plans[0];
  $('tradeoff').hidden=!top || dirty;
  if(!top)return;
  const meanBest=[...result.eligible].sort((a,b)=>b.average-a.average || b.floor-a.floor)[0];
  const same=meanBest.venue.id===top.venue.id;
  $('tradeoff').innerHTML=`<p class="eyebrow">WHY NEGOTIATE AS A GROUP?</p><h3>${same?'No tradeoff needed in this candidate pool.':'A higher average can leave someone behind.'}</h3><p>${same?'The leading choice also has the highest group average. We show this agreement instead of inventing a fairness improvement.':`An average-only rule would pick <strong>${escape(meanBest.venue.name)}</strong>, with the least-matched person at ${rounded(meanBest.floor)}. Prioritizing the lowest member score picks <strong>${escape(top.venue.name)}</strong>, at ${rounded(top.floor)}.`}</p><p class="muted small">${isLive()?'Computed from the same Qloo candidate pool. Relative ranks, not evidence of improved real-world satisfaction.':'Computed from authored demo scores. This demonstrates the ranking rule, not recommendation quality.'}</p>`;
}
