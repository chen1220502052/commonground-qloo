import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError,QlooClient,validateRequest,percentileScores,venueFromEntity } from '../server/qloo.mjs';
import { initialMembers,signals } from '../dist/fixtures.js';

const valid=()=>({members:structuredClone(initialMembers.slice(0,2)),constraints:{area:'all',maxDistanceKm:5,maxPriceLevel:3}});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const place=(n,affinity=.5)=>({entity_id:uuid(n),name:`Restaurant ${n}`,properties:{price_level:2,primary_genre:{id:'urn:tag:genre:place:restaurant',name:'Restaurant'},neighborhood:'East Village',address:'New York'},tags:[],location:{lat:40.736,lon:-73.990},popularity:n/10,query:{affinity}});

test('server rejects invalid signals, duplicate participants and arbitrary rejected IDs',()=>{
  const a=valid();a.members[0].signals=['not-a-signal'];assert.throws(()=>validateRequest(a),AppError);
  const b=valid();b.members[1].id=b.members[0].id;assert.throws(()=>validateRequest(b),/ID/);
  const c=valid();c.members[0].rejectedIds=['v1'];assert.throws(()=>validateRequest(c),/rejections/);
  const d=valid();d.constraints.area='__proto__';assert.throws(()=>validateRequest(d),/Neighborhood/);
});
test('percentiles preserve ranking and ties, with a neutral single candidate',()=>{
  assert.deepEqual(percentileScores([.1,.2,.2,.3]),[12.5,50,50,87.5]);
  assert.deepEqual(percentileScores([.8]),[50]);
  assert.deepEqual(percentileScores([.8,.8]),[50,50]);
});
test('missing price and coordinates remain unknown; restaurant bars are classified',()=>{
  const e=place(1);delete e.properties.price_level;delete e.location;
  const v=venueFromEntity(e);assert.equal(v.priceLevel,null);assert.equal(v.distanceKm,null);
  e.properties.primary_genre={id:'urn:tag:genre:place:restaurant:cocktail_bar',name:'Cocktail bar'};
  assert.equal(venueFromEntity(e).kind,'bar');
  e.properties.primary_genre={id:'urn:tag:genre:place:restaurant',name:'Restaurant'};
  e.tags=[{id:'urn:tag:amenity:qloo:full_bar'}];assert.equal(venueFromEntity(e).kind,'restaurant');
});
test('search resolves the exact name and type rather than choosing the first match',async()=>{
  const client=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async()=>Response.json({results:[{entity_id:uuid(1),name:'Patagonia',types:['urn:entity:locality']},{entity_id:uuid(2),name:'Patagonia',types:['urn:entity:brand']}]})});
  assert.equal((await client.resolveSignal('outdoor')).entityId,uuid(2));
});
test('429 is retried once, duplicate requests coalesce, and errors never echo upstream secrets',async()=>{
  let calls=0;
  const client=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async()=>{
    calls++;if(calls===1)return new Response('',{status:429,headers:{'retry-after':'0'}});
    return Response.json({results:[]});
  }});
  const responses=await Promise.all([client.get('/search',{query:'same'}),client.get('/search',{query:'same'})]);
  assert.equal(calls,2);assert.equal(responses[0],responses[1]);
  await client.get('/search',{query:'same'});assert.equal(calls,2);
  const bad=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async()=>new Response('upstream test-secret',{status:401})});
  await assert.rejects(()=>bad.get('/search',{query:'x'}),e=>e.status===502 && !e.message.includes('test-secret'));
});
test('same candidate pool is scored for each member; missing scores are excluded before ranking',async()=>{
  let requestedSignals=[];
  const client=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async value=>{
    const url=new URL(value);
    if(url.pathname==='/search'){
      const s=signals.find(x=>x.name===url.searchParams.get('query'));
      return Response.json({results:[{entity_id:uuid(signals.indexOf(s)+100),name:s.name,types:[s.entityType]}]});
    }
    if(url.searchParams.has('filter.results.entities')){
      requestedSignals.push(url.searchParams.get('signal.interests.entities'));
      assert.deepEqual(url.searchParams.get('filter.results.entities').split(','),[uuid(1),uuid(2),uuid(3)]);
      const first=requestedSignals.length===1;
      return Response.json({results:{entities:first?[place(1,.9),place(2,.7),place(3,.5)]:[place(1,.1),place(2,.9)]}});
    }
    return Response.json({results:{entities:[place(1),place(2),place(3)]}});
  }});
  const result=await client.negotiate(valid());
  assert.equal(requestedSignals.length,2);assert.notEqual(requestedSignals[0],requestedSignals[1]);
  assert.equal(result.metadata.scoredCandidates,2);
  assert.equal(result.excluded.find(x=>x.venue.id===uuid(3)).blocked[0],'Missing member affinity score');
  const memberScores=result.eligible.find(x=>x.venue.id===uuid(1)).memberScores;
  assert.deepEqual(memberScores.map(m=>m.score),[75,25]);
  assert.deepEqual(memberScores.map(m=>m.rawAffinity),[.9,.1]);
  assert.ok(result.metadata.notices.length>0);
});
test('a veto survives retrieval and no score can restore that venue',async()=>{
  const client=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async value=>{
    const url=new URL(value);
    if(url.pathname==='/search'){
      const s=signals.find(x=>x.name===url.searchParams.get('query'));
      return Response.json({results:[{entity_id:uuid(signals.indexOf(s)+100),name:s.name,types:[s.entityType]}]});
    }
    if(url.searchParams.has('filter.results.entities'))assert.ok(!url.searchParams.get('filter.results.entities').includes(uuid(1)));
    return Response.json({results:{entities:url.searchParams.has('filter.results.entities')?[place(2)]:[place(1),place(2)]}});
  }});
  const s=valid();s.members[0].rejectedIds=[uuid(1)];const result=await client.negotiate(s);
  assert.ok(result.plans.every(p=>p.venue.id!==uuid(1)));
  assert.equal(result.excluded.find(x=>x.venue.id===uuid(1)).blocked[0],'Alex rejected this venue');
});
test('inconsistent entity names cannot be assigned another venue’s score',async()=>{
  const client=new QlooClient({apiKey:'test-secret',minIntervalMs:0,fetchImpl:async value=>{
    const url=new URL(value);
    if(url.pathname==='/search'){
      const s=signals.find(x=>x.name===url.searchParams.get('query'));
      return Response.json({results:[{entity_id:uuid(signals.indexOf(s)+100),name:s.name,types:[s.entityType]}]});
    }
    const e=place(1);if(url.searchParams.has('filter.results.entities'))e.name='A different venue';
    return Response.json({results:{entities:[e]}});
  }});
  const result=await client.negotiate(valid());assert.equal(result.plans.length,0);
  assert.ok(result.excluded[0].blocked.includes('Inconsistent Qloo entity names'));
});
