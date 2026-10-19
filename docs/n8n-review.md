# Vej submission and reviewer guide

Prepared for **n8n-nodes-vej 0.3.1**, checked 2026-10-19. This is a submission kit, not a claim of n8n verification. The package is prepared locally; **npm publication, registry/provenance verification, reviewer service access, and Creator Portal submission remain pending**.

## Package identity and public links

| Item | Value |
| --- | --- |
| Service / node name | Vej |
| npm package | `n8n-nodes-vej` |
| Candidate version | `0.3.1` |
| Repository | https://github.com/LodeKennes/vej-n8n-node |
| Candidate source | https://github.com/LodeKennes/vej-n8n-node/tree/v0.3.1 |
| Release | https://github.com/LodeKennes/vej-n8n-node/releases/tag/v0.3.1 |
| npm listing, after publication | https://www.npmjs.com/package/n8n-nodes-vej |
| Service website | https://itsvej.com/ |
| Service account/access | https://app.itsvej.com/ |
| Documentation | [README](../README.md), [installation](installation.md), [operations](operations.md) |
| Authentication | Vej API key, Bearer header, n8n encrypted credential store |
| Maintainer | Lode Kennes; `hello@itsvej.com` in package metadata |
| Support | https://github.com/LodeKennes/vej-n8n-node/issues |
| Integration license | MIT; separately licensed brand/font/schema assets are attributed in [NOTICE](../NOTICE) |

The npm username is not inferred from the GitHub username. Before submission, verify the actual npm owner/maintainer is the intended Lode Kennes account and that its public identity matches the repository.

## Listing copy

These are ready-to-use descriptions, not a transcription of authenticated Creator Portal fields. Adjust their length to the actual form after signing in.

**Short description**

Assess decisions, documents, and records with Vej probabilities and native n8n forms.

**Long description**

Vej brings probability-based assessments to n8n. Define named outcomes, statements, or rubric levels with native form controls, then connect the results to your existing Switch, IF, review, and storage steps. Add repeatable questions, sources, document segments, records, and checks without writing JSON. Individual fields support n8n expressions.

The integration includes 33 actions across eight resources, covering native Choice, Noul, and Score decisions; eleven published Beta use cases; conversation and calibration lifecycle operations; retention; batches; and account information. Responses preserve probabilities, statuses, metadata, and usage. API access is required. Beta operations depend on deployment support; hosted batch execution, fast/careful effort, and ranking availability have documented limits.

**Examples to feature**

- Route a support request using named outcome probabilities: [Choice](../examples/01-choice.json).
- Assess several independent questions: [mixed questions](../examples/04-mixed-questions.json).
- Match one of your supplied records: [record matching](../examples/12-pick-the-correct-record.json).

**Suggested discovery terms:** Vej, probabilities, classification, document review, record matching, evidence, Choice, Noul, Score. Suggested category: Analytics. Vej assesses inputs; n8n's existing nodes own downstream workflow control.

## Brand and screenshots

| Asset | Link | Use |
| --- | --- | --- |
| Node icon | [SVG](../nodes/Vej/vej.svg) | Compact transparent Vej mark |
| Dark-theme icon | [SVG](../nodes/Vej/vej.dark.svg) | Reverse mark for dark surfaces |
| Wordmark | [SVG](../assets/logo.svg) / [reverse SVG](../assets/logo-light.svg) | Service identity |
| Banner | [PNG](../assets/banner.png) / [SVG](../assets/banner.svg) | Integration overview |
| Form screenshot | [PNG](../assets/n8n-node.png) | Native n8n Choice form, captured in n8n 2.43.8 |

Use the existing marks; do not add an n8n verification badge before approval. The screenshot is a local editor example, not evidence of a Cloud installation or live model output. Portal asset formats/dimensions are unverified until its authenticated form is available.

## Technical notes for the reviewer

- One service integration, implemented in TypeScript with **declarative REST routing**. `Vej.node.ts` declares the UI, credentials and routing hooks; `routing.ts` assembles requests in `preSend` and validates responses in `postReceive`. There is no custom `execute()` method.
- Node versions 1 and 2 remain available. Version 1 reads saved JSON inputs; version 2 defaults to native forms with optional Advanced JSON. The package version and node version are separate.
- Zero shipped external runtime dependencies. `n8n-workflow` is the sole peer dependency supplied by n8n. Bun, the official node CLI/scanner, TypeScript and test libraries are development tools.
- Runtime code does not read files or environment variables, execute commands, download models, or use another provider SDK. Build/test scripts are excluded from the package. Static authored JSON defaults are bundled modules.
- HTTP requests use n8n's authenticated routing helper. The only target is the credential's Vej service root, default `https://api.itsvej.com`; a trusted self-hosted Vej deployment can be selected explicitly. Redirect following is disabled. There is no analytics endpoint or background request.
- The API key is a password field in a Vej API credential. Credential testing calls `GET /v1/me`, without inference. API HTTP errors retain status and sanitized detail; server-echoed key values are redacted. Transport failures are handled by n8n's routing engine.
- Each successful input produces one paired output. Responses retain native probabilities and statuses, including HTTP 200 results that are unavailable or abstain. Version 2 deletion actions add `deleted: true`; version 1 retains its empty-response behavior.
- Risk, conditional questions, calibration and feedback can return more than ten top-level fields. These version 2 actions expose **Simplify** on ordinary nodes and **Output → Raw / Selected Fields / Simplified** on AI tools, following n8n's `@tool` UI context. Raw is the default. Simplified layouts contain at most ten fields, preserving outcome identity for risk and cleanup IDs for feedback; selected fields retain available resource IDs and risk candidate mappings. Version 1 always preserves raw output.
- No automatic retries are configured. Keep n8n's **Retry On Fail** disabled for writes. Conversation append/query require the returned expected sequence; retention changes are explicit administrator operations.
- n8n can retain workflow execution data according to its settings, independently of Vej's retention policy. Request state, sources, reviewed labels, and supplied record fields are sent to the configured Vej endpoint. The node does not submit anything to npm or the Creator Portal.

## Reviewer access: prepare before submitting

The repository contains no review key and does not provision an account. The maintainer must provide a reachable HTTPS deployment and a dedicated reviewer account with enough model/API access and credits to exercise the agreed scope. Confirm the account actually works before submission. Do not use production/customer data.

Share reviewer credentials only through the private mechanism n8n specifies in the authenticated review process. Never put keys, account passwords, calibration tokens, pre-signed storage URLs or private organization details into this repository, exported workflows, screenshots or public issues. Keep retention disabled unless the reviewer explicitly opts into a disposable test organization, and revoke review access after the review.

Disclose these service limitations up front:

| Scope | Review conditions |
| --- | --- |
| Choice, Noul, Score, multiple questions | Model access for `/v1/predict`; first review scenarios below |
| Account and usage | API key scopes for `/v1/me`, `/v1/models`, `/v1/usage` |
| Eleven Beta use cases | Early access and deployment support; full mapping in [operations](operations.md) |
| Conversations | Explicit states-retention consent, disposable history, sequence-aware cleanup |
| Calibration and feedback | Separate cohorts, correct binding and original scores; examples illustrate shape and do not qualify a risk target |
| Select effort | Standard executes; fast/careful may return unavailable within HTTP 200 |
| Rankings | Quality gate failed; unsupported deployments return `ranking_unavailable` |
| Batches | Hosted execution is not open without approved EU storage hosts; do not promise a successful hosted batch review |

n8n has not confirmed acceptance of these limited-access operations. The maintainer must agree on a testable review scope with n8n and disclose unsupported operations rather than presenting fixture success as hosted availability.

## Suggested manual review walkthrough

1. Install the published candidate package in a disposable self-hosted n8n instance; until publication, use the [compiled release installation](installation.md). Tests currently target n8n **2.43.8**. Cloud installation follows n8n verification.
2. Create a **Vej API** credential using the review service root and key; save/test it. An authorized hosted account should return a successful `/v1/me` test. A local inference-only server may not expose that account endpoint.
3. Import `01-choice.json`, select the credential, and inspect the **State**, **Question or Statement**, **Outcomes → Name / Description** controls. Use **Add Outcome** to add a third named outcome. Run it and inspect `answers.result.choice` and `answers.result.probabilities`; outcome identity should match the supplied names.
4. Import `02-noul.json` and `03-score.json`. Check the statement probability and ordered rubric probabilities. Score expectations use zero-based indices. Inspect result status as well as numerical values.
5. Import `04-mixed-questions.json`. Edit independent Choice, Noul and Score groups through the form. Each question keeps its own ID. Test duplicate IDs and a Score rubric with fewer than two levels; they should fail locally with an actionable validation error.
6. Supply several input items and map an individual field with an expression. Check that each result links to its originating item. Select **On Error → Continue** to inspect item errors; leave automatic retry disabled.
7. Import a Beta example only after its capability is enabled for the reviewer. Record matching illustrates typed text, numbers, booleans and null. Evidence/annotation offsets use Unicode code points. Deferred effort and ranking statuses must remain visible.
8. For conversation lifecycle testing, explicitly enable states retention in the disposable organization. Import `09-watch-a-conversation.json`; create and append use returned ID/sequence expressions. Query advances sequence; get metadata does not infer. A stale sequence should return HTTP 409. Delete with the current sequence and inspect `deleted: true`.
9. Switch a version 2 body action to **Input Method → Advanced JSON** and map a complete input object. Separately import an existing version 1 workflow to confirm stored inputs still work.
10. Remove disposable retained state, revoke any enabled review retention, and revoke the dedicated review key through Vej's account controls when review is complete. No review cleanup has been performed automatically.

Live API executions in these instructions may consume review credits. The maintainer must supply those; local fixture tests below perform no inference.

On large-response actions, test **Simplify** and compare with the full response. When connected as an AI tool, check **Output → Simplified / Raw / Selected Fields**. Per-field expressions work inside repeated rows. n8n does not support an expression that replaces a whole repeated collection; use Advanced JSON for dynamic bulk inputs.

## Reproducible evidence

Run from the repository root with Bun and Docker:

```bash
bun install --frozen-lockfile
bun run check
bun pm pack --destination artifacts
bun run scan:local
bun run test:n8n
bun run test:n8n:forms
bun run test:n8n:package
```

The pinned scanner is `@n8n/scan-community-package@0.39.0`. `scan:local` checks both source and the unpacked candidate tarball using n8n's analyzer with inline exceptions disabled. It does **not** validate npm provenance. `scan:registry` asserts the upstream result because its CLI may print a failure and still exit zero. Run it only after the exact version is published:

```bash
bun run scan:registry
```

That full scan requires npm metadata/provenance, fetches the public attested source, and scans the published artifact. See [validation](validation.md) for actual results and [requirements research](n8n-review-requirements.md) for primary sources and known uncertainties. CI checks source/artifact analysis plus real n8n execution; the manual publishing workflow repeats checks before registry publication and runs the registry scan afterwards.

## Final maintainer steps

- [ ] Confirm npm account ownership/public maintainer identity and configure initial granular-token or trusted publishing authority in GitHub/npm. No npm credentials or GitHub publishing secret were available during preparation.
- [ ] Dispatch **Publish to npm** from `v0.3.1`: `gh workflow run publish.yml --repo LodeKennes/vej-n8n-node --ref v0.3.1`. This makes a public npm publication; a GitHub release alone does not.
- [ ] Confirm the workflow's registry scan passes, the npm provenance source matches the release commit, and package/repository links and maintainer identity are correct. Record the actual npm version and successful workflow URL.
- [ ] Prepare and test dedicated reviewer service access with the scope/limitations above. No live service success has been asserted by this kit.
- [ ] Sign in at https://creators.n8n.io/nodes, inspect the real submission fields, and use this identity table, listing copy, assets and reviewer notes. Submit the published package for verification. Portal credentials and exact authenticated fields were unavailable during preparation.
- [ ] Record the submission ID/URL and respond to reviewer feedback. Do not advertise verification or Cloud availability until n8n approves it.

Current public requirements: [submission and provenance](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/), [technical verification](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/), [declarative REST style](https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-building-style/), [UX](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/).
