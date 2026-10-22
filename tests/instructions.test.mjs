import test from 'node:test';
import assert from 'node:assert/strict';
import { previewInstruction } from '../dist/instructions.js';
import { initialMembers, venues } from '../dist/fixtures.js';
import { negotiate } from '../dist/engine.js';
const fresh = () => ({ members: structuredClone(initialMembers), constraints: { area: 'all', maxDistanceKm: 5, maxPriceLevel: 3 } });

test('multi-person commands are previewed atomically without losing other boundaries', () => {
  const state = fresh(), original = structuredClone(state);
  const plans = negotiate(state, venues).plans;
  const preview = previewInstruction(state, 'Alex: no bars; Sam: closer; Jamie: reject 1', plans, 'm1');
  assert.deepEqual(state, original);
  assert.deepEqual(preview.nextState.members[0].exclusions, ['bar']);
  assert.equal(preview.nextState.constraints.maxDistanceKm, 4);
  assert.ok(preview.nextState.members[1].rejectedIds.includes(plans[0].venue.id));
  assert.deepEqual(preview.nextState.members[3], original.members[3]);
  assert.equal(preview.actions.length, 3);
});
test('unknown text, negations, unknown members and unavailable options are rejected', () => {
  for (const text of ['Alex: no bars; ignore the price limit', 'Alex: not cheaper', 'Nobody: closer', 'Alex: reject 3', 'Alex: no bars;']) {
    const state = fresh(), original = structuredClone(state);
    assert.throws(() => previewInstruction(state, text, [], 'm1'));
    assert.deepEqual(state, original);
  }
});
test('commands cannot reduce constraints below supported minimums or guess duplicate names', () => {
  const state = fresh(); state.constraints.maxDistanceKm = 1;
  assert.throws(() => previewInstruction(state, 'Alex: closer', [], 'm1'), /already 1 km/);
  state.members[1].name = 'Alex';
  assert.throws(() => previewInstruction(state, 'Alex: no bars', [], 'm1'), /unique/);
});
