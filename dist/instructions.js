import { applyFeedback } from './engine.js';

// Deliberately bounded commands, not a language-model impersonation. Parse all
// clauses before committing anything; unknown or contradictory text is rejected.
export function previewInstruction(state, text, plans, defaultMemberId) {
  if (typeof text !== 'string' || !text.trim() || text.length > 500) throw new Error('Enter a command of 1–500 characters.');
  const clauses = text.trim().split(/\s*;\s*/);
  if (clauses.length > 8 || clauses.some(c => !c)) throw new Error('Use up to eight commands separated by semicolons.');
  let nextState = structuredClone(state);
  const actions = [];
  for (const clause of clauses) {
    const parts = clause.split(':');
    if (parts.length > 2) throw new Error('Use “Name: command”.');
    const who = parts.length === 2 ? state.members.filter(m => m.name.toLowerCase() === parts[0].trim().toLowerCase()) : state.members.filter(m => m.id === defaultMemberId);
    if (who.length !== 1) throw new Error('Use a unique member name before each command.');
    const member = who[0];
    const command = parts.at(-1).trim().toLowerCase();
    let feedback;
    if (/^(no bars|avoid bars)$/.test(command)) feedback = { type: 'no-bars' };
    else if (/^(closer|cheaper)$/.test(command)) feedback = { type: command };
    else if (/^reject [1-3]$/.test(command)) {
      const venue = plans[Number(command.at(-1)) - 1]?.venue;
      if (!venue) throw new Error('That option is not in the current results.');
      feedback = { type: 'reject', venueId: venue.id };
    } else throw new Error('Supported commands: no bars, closer, cheaper, reject 1. Separate commands with semicolons.');
    nextState = applyFeedback(nextState, { ...feedback, memberId: member.id });
    const descriptions = { 'no-bars': 'avoid bars', closer: 'reduce the shared radius by 1 km', cheaper: 'lower the shared price cap by one tier', reject: `reject option ${command.at(-1)}` };
    actions.push({ memberId: member.id, type: feedback.type, venueId: feedback.venueId, description: `${member.name}: ${descriptions[feedback.type]}` });
  }
  return { nextState, actions };
}
