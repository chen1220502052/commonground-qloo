# CommonGround

## Tagline
A table everyone can agree on: Qloo-powered group dining negotiation that keeps every person's taste and boundaries in view.

## Inspiration
Choosing dinner for a group is not the same problem as recommending dinner to one person. A good average can hide a bad outcome for someone else. CommonGround explores a practical question: can cultural taste signals help a group find a common choice while keeping individual objections explicit?

## What it does
CommonGround helps 2–4 people compare dining options around Union Square in New York. Each person selects two things they enjoy across film, music, people and brands. Qloo grounds those signals in real venue recommendations. The app preserves individual profiles, enforces shared limits and personal vetoes, and offers a balanced choice alongside distinct alternatives.

When someone objects, the workflow previews a bounded change, replans against Qloo and explains the result. Supported commands such as “Alex: no bars; Sam: closer” are parsed by explicit rules, not a language model. Unknown instructions are rejected. Users can undo feedback, inspect exclusions and record agreement on a shared screen.

## How we built it
A dependency-free JavaScript frontend and Node server implement the local app. A standalone ESM Worker hosts the same frontend and Qloo workflow. API credentials remain server-side.

The Qloo integration resolves exact entity names and types, retrieves candidates per individual, applies hard constraints, and scores the same remaining venue IDs for every member. Requests are queued, coalesced and cached with a bounded retry for rate limits. Available original affinities and taste contributions remain inspectable.

We normalize each individual's affinities to midrank percentiles in the fully scored shared pool. The balanced strategy maximizes the lowest member percentile, then the mean. An average-only comparison uses that same pool and reports honestly when the rules select the same venue. Percentiles are relative ranks, not predicted satisfaction.

## Why Qloo matters
Our application code has no live mapping from a favorite film or brand to a restaurant. Qloo supplies that cross-domain cultural grounding and the per-person affinity evidence. Removing Qloo removes the live recommendation pipeline; the separately labeled fictional fixtures exist only to demonstrate interface behavior.

## Challenges
A merged group profile can conceal individual preferences. Raw affinities also should not be presented as directly comparable satisfaction probabilities. We kept profiles separate, scored one shared candidate set, exposed the normalization method and excluded missing or inconsistent records rather than filling gaps with plausible values. Feedback is committed only after successful replanning so failed API requests do not silently change the group's boundaries.

## Accomplishments
We implemented and tested real Qloo retrieval and shared-candidate scoring, hard-constraint enforcement, persistent vetoes, transactional feedback, bounded command previews, undo, an English interface, individual evidence and explicit group agreement. Automated tests cover ranking, ties, incomplete data, rate-limit behavior, state preservation and local/hosted HTTP boundaries.

## What we learned
Recommendation ranking and group agreement are different things. A score can surface a tradeoff; it cannot speak for the person affected. CommonGround keeps that decision with the group, including when no feasible option exists.

## What's next
Validate with real groups, add flexible meeting points and broader entity selection, and evaluate an optional language-model interpreter using the same validated feedback actions. We have not conducted a user study and do not claim measured satisfaction or time savings. The current prototype does not book venues or support remote voting.

## Built with
Qloo Taste AI API, JavaScript, HTML, CSS, Node.js, Cloudflare-compatible Workers, GitHub Actions.

## Links
- Application: https://commonground-qloo-chen1220502052.zephyer-1990.chatgpt.site
- Repository: https://github.com/chen1220502052/commonground-qloo
- Testing instructions: https://github.com/chen1220502052/commonground-qloo/blob/main/docs/judge-guide.md
