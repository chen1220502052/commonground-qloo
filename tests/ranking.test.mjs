import test from 'node:test';
import assert from 'node:assert/strict';
import {rankEvaluated} from '../dist/engine.js';

test('unknown popularity never masquerades as an undiscovered place',()=>{
  const rows=[
    {venue:{id:'a',distanceKm:1,popularity:.5},floor:90,average:90,blocked:[]},
    {venue:{id:'b',distanceKm:1,popularity:.5},floor:80,average:85,blocked:[]},
    {venue:{id:'c',distanceKm:1,popularity:null},floor:75,average:80,blocked:[]},
  ];
  const result=rankEvaluated(rows);
  assert.equal(result.plans.length,2);
  assert.ok(!result.plans.some(p=>p.strategy==='discovery'));
});
