# Delivery status — 2026-10-27

- Repository: https://github.com/chen1220502052/commonground-qloo (public; MIT recognized). Code update: `7aa923d`.
- Deployment: Sites reports public version 2 deployed successfully on 2026-10-27 from Site source commit `84714840d42222d3d138506893d2d8d0ea6733dd`.
- Application: https://commonground-qloo-chen1220502052.zephyer-1990.chatgpt.site
- Verification: 28 automated tests passed; the standalone Worker built and passed syntax and ESM export validation. The Worker rebuilt from GitHub source is byte-for-byte identical to the Site source and the Worker in the published archive. The Site uses a separate deployment repository; GitHub `59ab197` after `7aa923d` changed only this status document. Synthetic tests cover ambiguous entity matches, including the new fail-closed behavior. No new live Qloo request was verified after the change, so the default four-person flow remains unverified.
- Browser and network limit: Mac browser automation timed out when opening Devpost and the application; a direct request to the application returned Cloudflare 403. The public browser experience and production API behavior remain unverified from this environment.
- Devpost submission: **current status unknown**. The 2026-10-22 attempt timed out; it is not evidence of the current state. No new submission was attempted in this session. Check the account's existing submissions before creating or submitting anything.
- Data audit: the current source removes Qloo-derived entity IDs formerly used for disambiguation. Ambiguous exact matches now return an error instead of choosing an ID. Fixtures and mocked responses are authored synthetic examples. Previous Git history has not been rewritten and retains the earlier IDs.

## Devpost fields

- Project name: CommonGround
- Elevator pitch: A table everyone can agree on: Qloo-powered group dining negotiation that keeps every person's taste and boundaries in view.
- About the project: copy the sections in [submission.md](submission.md), excluding its initial title and final links if those have dedicated form fields.
- Built with: Qloo Taste AI API, JavaScript, HTML, CSS, Node.js, Cloudflare-compatible Workers, GitHub Actions.
- Try it out: the application URL above.
- Source code: the repository URL above.
- Testing instructions: https://github.com/chen1220502052/commonground-qloo/blob/main/docs/judge-guide.md

Before submission, verify the public live flow and existing Devpost state. The entrant must confirm applicable eligibility, ownership and team authority, and acceptance of the official rules; submission constitutes agreement to those rules. Do not infer personal declarations.
