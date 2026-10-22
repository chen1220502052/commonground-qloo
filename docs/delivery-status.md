# Delivery status — 2026-10-22

- Repository: https://github.com/chen1220502052/commonground-qloo (public; MIT recognized).
- CI: 27 tests passed, and the standalone Worker build and syntax check succeeded.
- Deployment: Sites version 1, publicly published successfully.
- Application: https://commonground-qloo-chen1220502052.zephyer-1990.chatgpt.site
- Runtime configuration: Qloo key installed as a server secret; no model key configured.
- Live integration: the built Worker successfully called Qloo and returned 36 candidates in approximately 17 seconds.
- Verification limit: direct requests from the authoring network to chatgpt.site returned a Cloudflare 403. This is an upstream access block, so public browser usability and production API behavior are not verified from this network.
- Visual/browser verification: unavailable in this session; browser controls timed out. Unit tests use a minimal DOM stub and do not establish visual correctness.
- Devpost submission: **not submitted**. Browser automation for the submission page timed out. The English submission copy and walkthrough are ready in this repository.

## Devpost fields

- Project name: CommonGround
- Elevator pitch: A table everyone can agree on: Qloo-powered group dining negotiation that keeps every person's taste and boundaries in view.
- About the project: copy the sections in [submission.md](submission.md), excluding its initial title and final links if those have dedicated form fields.
- Built with: Qloo Taste AI API, JavaScript, HTML, CSS, Node.js, Cloudflare-compatible Workers, GitHub Actions.
- Try it out: the application URL above.
- Source code: the repository URL above.
- Testing instructions: https://github.com/chen1220502052/commonground-qloo/blob/main/docs/judge-guide.md

Verify public access and the core live flow before the final submission. Review competition terms and required eligibility declarations personally; no declarations have been accepted on the entrant's behalf.
