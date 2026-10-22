export function validateState(state) {
  if (state.members.length < 2 || state.members.length > 4) return 'Keep 2–4 people in the group.';
  if (state.members.some(m => !m.name.trim() || !m.signals.length)) return 'Each person needs a name and at least one taste.';
  if (!Number.isFinite(state.constraints.maxDistanceKm) || state.constraints.maxDistanceKm <= 0) return 'The distance limit must be greater than zero.';
  if (!Number.isInteger(state.constraints.maxPriceLevel) || state.constraints.maxPriceLevel < 1 || state.constraints.maxPriceLevel > 4) return 'Choose a valid price tier.';
  return null;
}

export function evaluateVenue(venue, state) {
  const blocked = [];
  const c = state.constraints;
  if (c.area !== 'all' && venue.area !== c.area) blocked.push('Different neighborhood');
  if (venue.distanceKm > c.maxDistanceKm) blocked.push('Beyond the distance limit');
  if (venue.priceLevel > c.maxPriceLevel) blocked.push('Above the price tier');
  const memberScores = state.members.map(member => {
    if (member.exclusions.includes(venue.kind)) blocked.push(`${member.name} avoids ${venue.kind === 'bar' ? 'bars' : 'this type'}`);
    if (member.rejectedIds.includes(venue.id)) blocked.push(`${member.name} rejected this venue`);
    const evidence = [...new Set(member.signals)].map(id => ({ signalId: id, score: venue.mockAffinity[id] })).filter(x => Number.isFinite(x.score));
    const score = evidence.length ? evidence.reduce((sum,x) => sum+x.score,0)/evidence.length : null;
    if (evidence.length !== new Set(member.signals).size) blocked.push(`${member.name} has incomplete taste data`);
    return { memberId: member.id, name: member.name, score, evidence };
  });
  const scores = memberScores.map(m => m.score).filter(Number.isFinite);
  return { venue, memberScores, blocked: [...new Set(blocked)], floor: scores.length === state.members.length ? Math.min(...scores) : null, average: scores.length === state.members.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null };
}

export function negotiate(state, venues) {
  const error = validateState(state);
  if (error) return { error, plans: [], eligible: [], excluded: [] };
  const evaluated = venues.map(v => evaluateVenue(v,state));
  return rankEvaluated(evaluated);
}

export function rankEvaluated(evaluated) {
  const eligible = evaluated.filter(v => !v.blocked.length);
  const excluded = evaluated.filter(v => v.blocked.length);
  const balanced = [...eligible].sort((a,b) => b.floor-a.floor || b.average-a.average || a.venue.distanceKm-b.venue.distanceKm || a.venue.id.localeCompare(b.venue.id));
  const plans = [];
  if (balanced[0]) plans.push({ ...balanced[0], strategy: 'balanced' });
  const overall = eligible.filter(x => !plans.some(p => p.venue.id === x.venue.id)).sort((a,b) => b.average-a.average || b.floor-a.floor || a.venue.id.localeCompare(b.venue.id));
  if (overall[0]) plans.push({ ...overall[0], strategy: 'overall' });
  // Discovery remains inside the hard constraints; a mock floor is a heuristic, not a satisfaction promise.
  const discovery = eligible.filter(x => !plans.some(p => p.venue.id === x.venue.id) && x.floor >= 60 && Number.isFinite(x.venue.popularity)).sort((a,b) => a.venue.popularity-b.venue.popularity || b.floor-a.floor || a.venue.id.localeCompare(b.venue.id));
  if (discovery[0]) plans.push({ ...discovery[0], strategy: 'discovery' });
  return { error: null, plans, eligible, excluded };
}

export function applyFeedback(state, feedback) {
  const next = structuredClone(state);
  const member = next.members.find(m => m.id === feedback.memberId);
  if (!member) throw new Error('Feedback member not found.');
  if (feedback.type === 'reject') {
    if (!feedback.venueId) throw new Error('Choose a venue to reject.');
    member.rejectedIds = [...new Set([...member.rejectedIds, feedback.venueId])];
  } else if (feedback.type === 'no-bars') {
    member.exclusions = [...new Set([...member.exclusions, 'bar'])];
  } else if (feedback.type === 'closer') {
    if (next.constraints.maxDistanceKm <= 1) throw new Error('The radius is already 1 km. You can reject a specific venue instead.');
    next.constraints.maxDistanceKm = Math.max(1, next.constraints.maxDistanceKm-1);
  } else if (feedback.type === 'cheaper') {
    if (next.constraints.maxPriceLevel <= 1) throw new Error('The price tier is already at its minimum. You can reject a specific venue instead.');
    next.constraints.maxPriceLevel -= 1;
  } else throw new Error('Choose a supported feedback action.');
  return next;
}
