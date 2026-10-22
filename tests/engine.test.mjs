import test from 'node:test';
import assert from 'node:assert/strict';
import { negotiate, applyFeedback } from '../dist/engine.js';
import { initialMembers, venues } from '../dist/fixtures.js';
const state = () => ({ members: structuredClone(initialMembers), constraints: { area: 'all', maxDistanceKm: 5, maxPriceLevel: 3 } });
test('balanced selection protects weakest member instead of maximizing mean alone', () => {
  const result = negotiate(state(),venues);
  assert.equal(result.plans[0].venue.id,'v1');
  assert.ok(result.plans[1].average > result.plans[0].average);
  assert.ok(result.plans[0].floor > result.plans[1].floor);
  assert.equal(new Set(result.plans.map(x=>x.venue.id)).size,result.plans.length);
});
test('a member veto removes the venue from all strategies without mutating input', () => {
  const before = state();
  const next = applyFeedback(before,{ memberId: 'm3', type: 'reject', venueId: 'v1' });
  const result = negotiate(next,venues);
  assert.ok(result.plans.every(p=>p.venue.id !== 'v1'));
  assert.ok(result.excluded.find(p=>p.venue.id==='v1').blocked.includes('Sam rejected this venue'));
  assert.deepEqual(before.members[2].rejectedIds,[]);
});
test('every recommendation respects all hard constraints and personal exclusions', () => {
  const next = applyFeedback(state(),{ memberId: 'm1', type: 'no-bars' });
  next.constraints = { area: 'East Village', maxDistanceKm: 1.3, maxPriceLevel: 2 };
  const result = negotiate(next,venues);
  assert.equal(result.eligible.length,2);
  for(const p of result.plans) {
    assert.equal(p.venue.area,'East Village');
    assert.ok(p.venue.distanceKm <= 1.3 && p.venue.priceLevel <= 2);
    assert.notEqual(p.venue.kind,'bar');
  }
});
test('impossible constraints produce no fabricated fallback or relaxed conditions', () => {
  const next = state();
  next.constraints = { area: 'Chelsea', maxDistanceKm: 1, maxPriceLevel: 1 };
  const result = negotiate(next,venues);
  assert.equal(result.plans.length,0);
  assert.equal(result.excluded.length,venues.length);
  assert.equal(next.constraints.maxDistanceKm,1);
});
test('unknown taste evidence does not become a zero or plausible recommendation', () => {
  const next = state(); next.members[0].signals = ['unknown'];
  assert.equal(negotiate(next,venues).eligible.length,0);
});
test('minimum constraints and invalid members return actionable errors', () => {
  const next = state(); next.constraints.maxPriceLevel = 1;
  assert.throws(()=>applyFeedback(next,{memberId:'m1',type:'cheaper'}), /minimum/);
  assert.throws(()=>applyFeedback(next,{memberId:'missing',type:'reject',venueId:'v1'}), /not found/);
  next.members = [next.members[0]];
  assert.match(negotiate(next,venues).error,/2–4/);
});
