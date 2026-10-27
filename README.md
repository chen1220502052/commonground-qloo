# CommonGround

**Different tastes. One shared table.**

CommonGround is a Qloo-powered group dining negotiation tool for 2–4 people. It keeps individual tastes separate, finds real dining venues, makes tradeoffs inspectable, and replans when someone objects.

- [Hosted application](https://commonground-qloo-chen1220502052.zephyer-1990.chatgpt.site)
- [Judge walkthrough](docs/judge-guide.md)
- [Submission description](docs/submission.md)
- [MIT license](LICENSE)

See [delivery status](docs/delivery-status.md) for the latest deployment and verification record.

## What works

1. Resolve a curated selection of films, artists, people and brands using Qloo entity search.
2. Retrieve venues separately for each person rather than merging everyone into one taste profile.
3. Enforce shared radius, neighborhood and price caps, plus personal bar exclusions and venue vetoes.
4. Query every person against the same remaining candidate IDs, then compare their relative ranks.
5. Offer a max-min balanced choice, a highest-average remaining alternative, and an optional discovery choice.
6. Inspect original affinities, available taste contributions and exclusions.
7. Preview commands such as `Alex: no bars; Sam: closer`, apply them atomically, and undo feedback.
8. Record each person's agreement on a shared screen. A new round clears previous agreement.

The command interface is a bounded rule-based parser, **not a connected language model**. It rejects unsupported text instead of guessing. This project implements a deterministic, human-in-the-loop negotiation workflow; it does not claim autonomous booking or general language understanding.

## Run locally

Node.js 22+ is required. There are no third-party runtime dependencies.

```sh
cp .env.example .env.local
# Set QLOO_API_KEY in .env.local for live results.
npm start
```

Open http://127.0.0.1:4318/. Without a configured key, the app offers authored demo fixtures. Live errors never silently turn into fictional results. Keys remain server-side; `.env.local` is ignored by Git.

```sh
npm test
npm run build:worker
```

The build emits a standalone Cloudflare-compatible ESM Worker at `artifacts/worker/index.js`. Configure `QLOO_API_KEY` as a hosted runtime secret. The Worker includes only an explicit static asset allowlist and server code; the build never reads an env file. Its `fetch(request, env)` export supports the same `/api/status` and `/api/negotiate` endpoints as the local server.

## How ranking works

Hard constraints precede taste. Each person's raw Qloo affinities are converted to midrank empirical percentiles over the same fully scored candidate set:

`100 × (number below + 0.5 × number tied) / pool size`

A tie or single candidate can produce 50. This preserves individual ordering and avoids treating raw affinities as comparable calibrated satisfaction scores.

- **Everyone considered:** maximize the lowest member percentile, then mean percentile.
- **Highest-average alternative:** highest mean among distinct remaining options.
- **A little discovery:** lower known popularity among remaining venues, provided every member percentile is at least 60.

Missing affinity, price or coordinates, inconsistent entity names, known closures and hard-constraint failures exclude a venue. No hard boundary is silently relaxed. The comparison panel shows the actual mean-only winner from the same candidate pool. If it agrees with the balanced winner, the app says so.

## Limitations and data use

- Fixed meeting point: Union Square, New York. Distances are straight-line, not walking times.
- Taste selection is curated; arbitrary entity search is not exposed to visitors.
- Relative ranks change when the candidate pool changes; do not compare percentiles across rounds.
- No user-study results or satisfaction improvements are claimed. Tests verify implementation and constraints, not actual enjoyment.
- Names, preferences, feedback history and shared-screen agreement live in browser memory. There is no account system, persistence or remote voting. The server receives names as part of group state but sends Qloo entity IDs, location and venue filters upstream, not names.
- Verify venue hours, menus, dietary needs, allergies, accessibility and reservations directly with the venue. “Avoid bars” relies on category data and does not guarantee an alcohol-free venue. No bookings are made.
- Qloo responses may be cached in server memory for up to 10 minutes. Application-computed percentile rankings are heuristics, not satisfaction predictions.
- The public Worker limits concurrent negotiation and applies an in-memory cooldown. These are best-effort per-isolate protections, not a durable global quota service.

## Source map

- `dist/`: English frontend, illustrative fixtures, ranking and command preview.
- `server/qloo.mjs`: live entity resolution, retrieval, candidate scoring and caching.
- `server/index.mjs`: local Node HTTP adapter.
- `server/worker-handler.mjs`: hosted request boundary.
- `scripts/build-worker.mjs`: dependency-free, credential-free Worker bundling.
- `tests/`: scoring, constraints, async state, command preview and HTTP boundary tests.

Built for the Qloo Agentic Hackathon 2026. Qloo data is obtained from the hackathon API; the repository license covers our code and authored fixtures, not third-party Qloo data or trademarks.
