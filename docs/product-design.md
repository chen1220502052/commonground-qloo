# Product design: CommonGround

## Audience and scope

A shared-screen decision room for 2–4 friends choosing a meal near Union Square, New York. Each person keeps an individual taste profile, personal type exclusions and explicit venue vetoes. The group shares neighborhood, distance and price boundaries.

The shipped interface is English. Live Qloo data and authored demo fixtures are separate modes. The app is a bounded negotiation tool; no language model, reservations, user accounts, persistence or multi-device voting are implemented.

## Workflow

1. Collect individual taste signals and shared boundaries.
2. Resolve exact Qloo entities by name and type, using previously verified IDs only to disambiguate curated choices.
3. Retrieve candidates separately per member, union by entity ID and remove inconsistent records.
4. Apply hard constraints and existing vetoes before scoring.
5. Score identical candidate IDs for each member. Remove incomplete rows and compute each member's midrank percentiles in the remaining common pool.
6. Rank a balanced option by minimum member percentile, then mean. Offer distinct average-first and optional discovery alternatives.
7. Show the actual average-only winner to make tradeoffs inspectable, including when it agrees with the balanced choice.
8. Preview explicit multi-person commands or accept structured feedback, requery Qloo and commit settings only after success. Undo is another successful-query transaction.
9. Record each member's explicit agreement on the leading option. Clear all old agreement on a new successful round or input edit.

## Boundaries and evidence

Hard constraints are never relaxed automatically. Missing prices, coordinates or scores and inconsistent entity names are excluded. Missing explanatory contributions are acknowledged. Raw affinities remain visible. Percentiles do not estimate satisfaction, and ranks from different candidate pools must not be treated as longitudinal improvement.

Commands are exact, case-insensitive rules: `Name: no bars`, `Name: closer`, `Name: cheaper`, `Name: reject 1`. Semicolons combine up to eight commands. All clauses must parse before a preview is accepted. Duplicate member names, unsupported text, invalid options and below-minimum constraints fail without mutation.

Agreement is a shared-screen record entered with the person present. It is not inferred consent, authenticated voting or a booking.

## Deployment architecture

The local Node server exposes an explicit asset allowlist and JSON API. A dependency-free build embeds those same assets and the Qloo client into a standalone ESM Worker. Qloo credentials are configured as hosted runtime secrets and never included in source or browser assets. Public endpoints enforce content type, body size and same-origin checks. Queuing, caching, coalescing, a bounded rate-limit retry and an in-memory public cooldown reduce redundant requests. The cooldown is not a durable global quota mechanism.

## Verification

The automated suite exercises group scoring, ties, missing data, hard constraints, vetoes, command preview and undo, state preservation after failures, explicit agreement invalidation and local/hosted request boundaries. On 2026-10-22 the standalone Worker called the real Qloo hackathon API and returned 36 candidates in about 17 seconds for the default group. These are implementation checks, not a user study.

Public Chrome verification succeeded on 2026-10-29 after repairing Worker fetch receiver and redirect-mode compatibility, isolating request-bound client queues, and disambiguating the director signal from returned role evidence. The live default flow returned 36 candidates, and the second request also completed. CommonGround has been submitted on Devpost. See the delivery status for the submission link and validation limits.

## Next work

Real-group studies, optional language-model intent parsing using the same validated feedback actions, flexible meeting points, wider entity selection and remote consent. No measured user benefits are claimed before those studies exist.
