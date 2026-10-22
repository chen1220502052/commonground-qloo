import { signals } from '../dist/fixtures.js';
import { rankEvaluated } from '../dist/engine.js';

export const MEETING_POINT = { name: 'Union Square', lat: 40.7359, lon: -73.9903 };
const NEIGHBORHOODS = { all: null, 'East Village': 'East Village, New York', SoHo: 'SoHo, New York', Chelsea: 'Chelsea, Manhattan, New York' };
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
// Curated choices verified through the hackathon /search response. Still require
// an exact name/type match; use these only to disambiguate this fixed catalogue.
const VERIFIED_ENTITIES = {
  nolan:'F253F706-4D0B-41A1-88DB-C8C5EC483E98',
  jazz:'578CFC26-B696-449A-9655-3FB270DDA725',
  pop:'4BBEF799-A0C4-4110-AB01-39216993C312',
  indie:'AFBC71A7-9439-4AB0-AB68-D14B11AAF836',
  outdoor:'DB4CE34E-3A63-4947-946F-9D52502C5762',
  design:'E12201A5-CC50-40AF-97AE-C54A2CA303F7',
  street:'C70CE2B8-0AD1-4150-BF18-5A6347F2E860',
};

export class AppError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function validateRequest(input) {
  if (!input || !Array.isArray(input.members) || input.members.length < 2 || input.members.length > 4) throw new AppError('Provide 2–4 people.',400);
  const ids = new Set();
  const members = input.members.map(member => {
    if (!member || typeof member.id !== 'string' || !/^m\d{1,6}$/.test(member.id) || ids.has(member.id)) throw new AppError('Member ID is invalid or duplicated.',400);
    ids.add(member.id);
    if (typeof member.name !== 'string' || !member.name.trim() || member.name.length > 16) throw new AppError('Each person needs a name of 1–16 characters.',400);
    if (!Array.isArray(member.signals) || member.signals.length < 1 || member.signals.length > 3 || new Set(member.signals).size !== member.signals.length || member.signals.some(id=>!signals.some(s=>s.id===id))) throw new AppError('Choose valid, distinct taste signals.',400);
    const exclusions=member.exclusions ?? [], rejectedIds=member.rejectedIds ?? [];
    if (!Array.isArray(exclusions) || exclusions.some(x=>x!=='bar') || !Array.isArray(rejectedIds) || rejectedIds.length>50 || rejectedIds.some(x=>typeof x!=='string' || !UUID.test(x))) throw new AppError('Venue rejections or type exclusions are invalid.',400);
    return { id:member.id, name:member.name.trim(), signals:[...member.signals], exclusions:[...exclusions], rejectedIds:[...new Set(rejectedIds)] };
  });
  const c=input.constraints;
  if (!c || !Object.hasOwn(NEIGHBORHOODS,c.area) || !Number.isInteger(c.maxDistanceKm) || c.maxDistanceKm<1 || c.maxDistanceKm>10 || !Number.isInteger(c.maxPriceLevel) || c.maxPriceLevel<1 || c.maxPriceLevel>4) throw new AppError('Neighborhood, distance or price limits are invalid.',400);
  return { members, constraints:{area:c.area,maxDistanceKm:c.maxDistanceKm,maxPriceLevel:c.maxPriceLevel} };
}

export function percentileScores(values) {
  // Midrank empirical percentile in one shared, fully scored candidate set.
  // All ties receive the same score; one candidate gets 50, not a false 100% match.
  return values.map(value => 100*(values.filter(x=>x<value).length + values.filter(x=>x===value).length/2)/values.length);
}

export function distanceKm(location, origin = MEETING_POINT) {
  if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lon)) return null;
  const radians=x=>x*Math.PI/180;
  const a=Math.sin(radians(location.lat-origin.lat)/2)**2+Math.cos(radians(origin.lat))*Math.cos(radians(location.lat))*Math.sin(radians(location.lon-origin.lon)/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export function venueFromEntity(entity) {
  const p=entity.properties || {};
  const tags=[...(entity.tags || []),...(p.good_for || []),p.primary_genre].filter(Boolean);
  const ids=tags.map(t=>t.id || '').filter(id=>/^urn:tag:(genre|category):/.test(id));
  const isBar=ids.some(id=> /(?:^|:|_)(?:bar|pub|nightclub)(?:$|_)|:(?:jazz_club|rock_music_club)$/.test(id));
  return {
    id:entity.entity_id, name:entity.name, kind:isBar?'bar':'restaurant', label:p.primary_genre?.name || 'Dining venue',
    area:p.neighborhood || p.geocode?.name || p.geocode?.city || 'Neighborhood unconfirmed',
    distanceKm:distanceKm(entity.location), priceLevel:Number.isInteger(p.price_level)?p.price_level:null,
    popularity:Number.isFinite(entity.popularity)?entity.popularity:null,
    description:typeof p.description==='string'?p.description:'Qloo did not provide a description.',
    address:typeof p.address==='string'?p.address:'Address unconfirmed',
    website:typeof p.website==='string' && /^https?:\/\//i.test(p.website)?p.website:null,
    source:'qloo', categoryKnown:ids.length>0, closed:p.is_closed===true,
  };
}

export class QlooClient {
  constructor({ apiKey, baseUrl='https://hackathon.api.qloo.com', fetchImpl=fetch, minIntervalMs=1000 }) {
    if (baseUrl !== 'https://hackathon.api.qloo.com') throw new Error('Only the hackathon API server is configured for this project.');
    this.apiKey=apiKey;this.baseUrl=baseUrl;this.fetchImpl=fetchImpl;this.cache=new Map();this.inflight=new Map();
    this.queue=Promise.resolve();this.lastStarted=0;this.minIntervalMs=minIntervalMs;
  }
  async request(url) {
    const task=this.queue.then(async()=>{
      for(let attempt=0;attempt<2;attempt++){
        const pause=Math.max(0,this.minIntervalMs-(Date.now()-this.lastStarted));
        if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
        this.lastStarted=Date.now();
        const response=await this.fetchImpl(url,{headers:{'X-Api-Key':this.apiKey},signal:AbortSignal.timeout(25000),redirect:'error'});
        if(response.status!==429 || attempt===1)return response;
        const retryAfter=response.headers.get('retry-after');
        const delay=retryAfter && /^\d+$/.test(retryAfter)?Number(retryAfter)*1000:2000;
        if(delay>15000)return response;
        await response.body?.cancel();
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      }
    });
    this.queue=task.catch(()=>{});
    return task;
  }
  async get(path,params) {
    if (!this.apiKey) throw new AppError('The server has no Qloo API key configured.',503);
    const query=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined && v!==null).sort(([a],[b])=>a.localeCompare(b)));
    const key=`${path}?${query}`;
    const cached=this.cache.get(key);if(cached && cached.expiry>Date.now()) return cached.data;
    if(this.inflight.has(key))return this.inflight.get(key);
    const request=(async()=>{
      let response;
      try { response=await this.request(`${this.baseUrl}${key}`); }
      catch { throw new AppError('Qloo timed out or could not be reached. Please retry.',504); }
      if(!response.ok) {
        const messages={401:'Qloo authentication failed. Check server configuration.',403:'The hackathon account cannot access this endpoint.',429:'Qloo rate limit reached. Please retry shortly.',400:'Qloo rejected the query parameters.'};
        throw new AppError(messages[response.status] || 'Qloo is temporarily unavailable. Please retry.',response.status===429?429:502);
      }
      let data;try{data=await response.json();}catch{throw new AppError('Qloo returned an unreadable response.');}
      if(data.success===false || data.error)throw new AppError('Qloo could not complete the query.');
      if(this.cache.size>=64)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key,{data,expiry:Date.now()+10*60*1000});return data;
    })();
    this.inflight.set(key,request);
    try{return await request;}finally{this.inflight.delete(key);}
  }
  async resolveSignal(signalId) {
    const signal=signals.find(s=>s.id===signalId);
    const data=await this.get('/search',{query:signal.name,take:10});
    const matches=(data.results || []).filter(e=>normalize(e.name)===normalize(signal.name) && e.types?.includes(signal.entityType));
    const unique=[...new Map(matches.map(e=>[e.entity_id,e])).values()];
    const chosen=unique.length===1?unique[0]:unique.find(e=>e.entity_id===VERIFIED_ENTITIES[signalId]);
    if(!chosen) throw new AppError(`Could not unambiguously resolve ${signal.name}. Choose another taste and retry.`,422);
    return { signalId, entityId:chosen.entity_id, name:chosen.name, type:signal.entityType };
  }
  async negotiate(input) {
    const state=validateRequest(input);
    const signalIds=[...new Set(state.members.flatMap(m=>m.signals))];
    const resolved=await Promise.all(signalIds.map(id=>this.resolveSignal(id)));
    const lookup=new Map(resolved.map(s=>[s.signalId,s]));
    const base={'filter.type':'urn:entity:place','filter.location':`POINT(${MEETING_POINT.lon} ${MEETING_POINT.lat})`,'filter.location.radius':state.constraints.maxDistanceKm*1000,'filter.price_level.max':state.constraints.maxPriceLevel,'filter.tags':'urn:tag:genre:place:restaurant',take:12};
    if(state.constraints.area!=='all')base['filter.location.query']=NEIGHBORHOODS[state.constraints.area];
    // Individual retrieval prevents a merged profile from erasing someone's preferences.
    const retrievals=await Promise.all(state.members.map(member=>this.get('/v2/insights',{...base,'signal.interests.entities':member.signals.map(id=>lookup.get(id).entityId).sort().join(',')})));
    const entities=new Map(), inconsistentIds=new Set();
    for(const data of retrievals){
      if(!Array.isArray(data.results?.entities))throw new AppError('Unexpected Qloo venue response format.');
      for(const entity of data.results.entities){
        if(!UUID.test(entity.entity_id || '') || !entity.name)continue;
        const existing=entities.get(entity.entity_id);
        if(existing && normalize(existing.name)!==normalize(entity.name))inconsistentIds.add(entity.entity_id);
        else entities.set(entity.entity_id,entity);
      }
    }
    const evaluated=[...entities.values()].map(entity=>{
      const venue=venueFromEntity(entity),blocked=[];
      if(inconsistentIds.has(venue.id))blocked.push('Inconsistent Qloo entity names');
      if(venue.closed)blocked.push('Marked closed by Qloo');
      if(venue.distanceKm===null)blocked.push('Missing venue coordinates');
      else if(venue.distanceKm>state.constraints.maxDistanceKm)blocked.push('Beyond the distance limit');
      if(venue.priceLevel===null)blocked.push('Missing price tier');
      else if(venue.priceLevel>state.constraints.maxPriceLevel)blocked.push('Above the price tier');
      if(state.constraints.area!=='all' && normalize(venue.area)!==normalize(state.constraints.area))blocked.push('Different neighborhood');
      for(const m of state.members){
        if(m.rejectedIds.includes(venue.id))blocked.push(`${m.name} rejected this venue`);
        if(m.exclusions.includes('bar')){
          if(venue.kind==='bar')blocked.push(`${m.name} avoids bars`);
          else if(!venue.categoryKnown)blocked.push('Missing category evidence to verify the no-bars boundary');
        }
      }
      return {venue,blocked:[...new Set(blocked)],memberScores:[],floor:null,average:null};
    });
    let pool=evaluated.filter(e=>!e.blocked.length);
    const notices=[];
    if(pool.length){
      const candidateIds=pool.map(x=>x.venue.id).sort().join(',');
      const rescored=await Promise.all(state.members.map(m=>this.get('/v2/insights',{'filter.type':'urn:entity:place','filter.results.entities':candidateIds,'signal.interests.entities':m.signals.map(id=>lookup.get(id).entityId).sort().join(','),'feature.explainability':true,take:pool.length})));
      const matrices=rescored.map(data=>{
        if(!Array.isArray(data.results?.entities))throw new AppError('Unexpected Qloo affinity response format.');
        return new Map(data.results.entities.map(entity=>[entity.entity_id,entity]));
      });
      for(const row of pool){
        for(const matrix of matrices){
          const e=matrix.get(row.venue.id);
          if(!Number.isFinite(e?.query?.affinity))row.blocked.push('Missing member affinity score');
          else if(normalize(e.name)!==normalize(row.venue.name))row.blocked.push('Inconsistent Qloo entity names');
        }
        row.blocked=[...new Set(row.blocked)];
      }
      pool=pool.filter(row=>!row.blocked.length);
      for(let i=0;i<state.members.length;i++){
        const member=state.members[i];
        const raw=pool.map(row=>matrices[i].get(row.venue.id).query.affinity);
        const scores=percentileScores(raw);
        pool.forEach((row,j)=>{
          const entity=matrices[i].get(row.venue.id);
          const contributions=entity.query.explainability?.['signal.interests.entities'];
          const evidence=Array.isArray(contributions)?contributions.flatMap(e=>{
            const signal=resolved.find(s=>s.entityId===e.entity_id && member.signals.includes(s.signalId));
            return signal && Number.isFinite(e.score)?[{signalId:signal.signalId,score:e.score,kind:'contribution'}]:[];
          }):[];
          row.memberScores.push({memberId:member.id,name:member.name,score:scores[j],rawAffinity:raw[j],evidence});
        });
      }
      for(const row of pool){row.floor=Math.min(...row.memberScores.map(m=>m.score));row.average=row.memberScores.reduce((sum,m)=>sum+m.score,0)/state.members.length;}
      if(pool.some(row=>row.memberScores.some(m=>!m.evidence.length)))notices.push('Some venues have no taste-contribution explanations. Available affinities and ranks are shown.');
    }
    const result=rankEvaluated(evaluated);
    return {...result,source:'qloo',totalCandidates:evaluated.length,metadata:{queriedAt:new Date().toISOString(),meetingPoint:MEETING_POINT,scoreMethod:'midrank-percentile',scoredCandidates:pool.length,resolvedSignals:resolved,notices,description:'Scores are midrank percentiles in this shared candidate pool, not satisfaction probabilities. Raw affinities remain in the individual evidence.'}};
  }
}
