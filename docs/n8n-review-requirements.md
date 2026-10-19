# n8n verification requirements and remaining review questions

Checked **2026-10-19** against public first-party documentation and the published
`@n8n/scan-community-package@0.39.0` implementation. This is preparation for
verified community-node review and discovery in n8n Cloud/self-hosted node
panels; it is not an approval or submission receipt. Research ran on
`db-xps-02` in `/home/lode/Projects/Lode/vej-n8n-node`, starting at
`a4e831af247fed3a5f4f85bcde9b9dcf7c442378`; implementation changes were being made
by the parent agent during research.

**Required** below means an explicit public requirement. **Recommended** means
documented advice or this note's preparation recommendation. **Unknown** means
the inspected public sources do not settle the question.

## Public eligibility and security requirements

| Status | Requirement |
| --- | --- |
| Required | Package name begins `n8n-nodes-` or `@<scope>/n8n-nodes-`; keywords include `n8n-community-node-package`; `package.json.n8n` lists node/credential build paths. |
| Required | Publish to npm before final vetting, pass automated checks, test locally, and provide a public README. |
| Recommended | Use the official `n8n-node` scaffolding/tool; the submission page explicitly says scaffolding is not strictly mandatory. |

Source: [submission standards](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/).

| Status | Requirement |
| --- | --- |
| Required | Public GitHub repository, working matching npm repository link and matching maintainer identity; MIT package license. |
| Required | No shipped runtime dependencies; no node access to environment variables or filesystem. Supply inputs through parameters. |
| Required | TypeScript, validation/error handling, English UI and documentation, and passing official scanner. |
| Required | Do not duplicate an existing integration; Logic/Flow control nodes are not currently accepted. |
| Review criterion | Integrate one third-party service per package; unrelated multi-service/proxy packages generally do not qualify. |
| Required documentation | Usage, examples and authentication instructions. |

Source: [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/).

Vej should be described as a Vej service integration returning assessments, with
downstream routing performed by existing n8n nodes. Its README already makes
that distinction. Separate Vej resources do not themselves constitute separate
third-party services. This is an interpretation of the criterion, not n8n's
eligibility decision.

## Programmatic action-node policy

**Required direction, with exceptions:** current guidance says to build new
REST action nodes declaratively. Programmatic style is reserved for triggers,
non-REST integrations, transformations beyond routing, or feature-based
versioning requiring code. Declarative routing supports request `preSend` and
response `postReceive` hooks; request construction alone does not establish an
exception. Programmatic triggers can coexist with declarative actions.
[Node-building style policy](https://docs.n8n.io/connect/create-nodes/plan-your-node/choose-a-node-building-style/).

Initial inspection found `execute()` in `nodes/Vej/Vej.node.ts`. Its per-item
REST request construction and light versioning did not establish a documented
exception. The 0.3.1 candidate replaces it with declarative request/response hooks;
the implementation validation record covers resulting behavior in n8n.
Public documentation does not state that every programmatic action is forbidden
or that a scanner pass grants an exception.

## UX review checklist

The UI must conform to the [UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/):

- **Required:** sensitive credentials use password fields; include OAuth when
  the service supports it.
- **Required conventions:** title case for labels/operation names; sentence
  case for actions/descriptions; action labels identify the resource/object.
  Boolean descriptions begin with “Whether”. Errors explain the issue and a
  way to recover.
- **Conditional requirements:** deletion returns a confirmation object;
  responses exceeding ten fields need a Simplify control. AI tools use
  Simplified/Raw/Selected fields output choices in that case.
- **Recommended where applicable:** common CRUD operations, Resource Locator
  controls, `From list` as locator default, familiar service terminology and
  simple examples in placeholders.

Vej's credential API key has `password: true`. Initial inspection found title-case
action labels and no Simplify/Output control. The 0.3.1 candidate adds sentence-case
actions, version 2 deletion confirmations, and context-specific Simplify/Output
controls for larger Beta responses. Raw remains the default. These changes need
the implementation's validation evidence; research alone does not establish UI correctness.

## npm publication and provenance

**Required since 2026-05-01:** verification submissions must be published from
GitHub Actions with npm provenance; local publication is not accepted. The
submission documentation allows trusted publishing or a granular npm token.
Its existing-node template guidance requires `@n8n/node-cli >=0.23.0` when using
that CLI's provenance-capable workflow. n8n retains discretion to reject nodes
competing with paid features.
[Submission and publishing policy](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/).

For the token route, npm documents a GitHub-hosted runner,
`permissions: { id-token: write }`, a matching public repository in
`package.json`, and:

```sh
npm publish --provenance --access public
```

Provenance establishes source/build linkage, not code safety.
[npm provenance prerequisites](https://docs.npmjs.com/generating-provenance-statements).

**Recommended:** npm trusted publishing avoids a persistent publishing token.
It requires npm CLI **11.5.1+**, Node **22.14.0+**, a supported hosted runner,
and package-level configuration for the authorized owner/repository/workflow
filename. GitHub OIDC publication automatically generates provenance for public
packages from public repositories. Configuring trust is separate from executing
a successful publication.
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Vej's `.github/workflows/publish.yml` has a hosted runner, OIDC permission,
matching-tag guard, checks, packing and npm publication with provenance. Those
files are preparation; no successful registry publication is established here.
Public `GET https://registry.npmjs.org/n8n-nodes-vej` returned **404** during this
research. The full registry/provenance scan therefore remains pending.

## Actual scanner command and local support

The documented command is:

```sh
npx @n8n/scan-community-package n8n-nodes-vej
```

For a reproducible post-publication check, pin both versions, for example:

```sh
npx --yes @n8n/scan-community-package@0.39.0 n8n-nodes-vej@0.3.1
```

**Observed implementation, 0.39.0:** the CLI accepts a registry
`<package-name>[@version]`, not a local path/tarball or `--help` mode. It checks
registry provenance, fetches the attested public GitHub source and published
tarball, and scans both with inline lint suppressions disabled. Its failure
output alone is insufficient as an exit-code gate: a returned
`passed: false` does not explicitly set a failing CLI exit code.
[Published scanner artifact](https://registry.npmjs.org/@n8n/scan-community-package/-/scan-community-package-0.39.0.tgz),
[official CLI source](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/scan-community-package/scanner/cli.mjs).

The module exports `analyzePackage(directory, filePatterns)` and
`SOURCE_FILE_PATTERNS` for local analysis. A local wrapper can assert
`result.passed` and separately check an unpacked build. **This does not verify
registry provenance, remote source accessibility, publication or n8n approval.**
[Official analyzer source](https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/scan-community-package/scanner/scanner.mjs).

No scanner was executed in this research workstream. Local gate results belong
in the implementation validation record with their actual command/revision.

## Creator Portal, service availability and review access

**Required:** sign in and submit through the
[Creator Portal](https://creators.n8n.io/nodes), as directed by the
[submission procedure](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/).

**Unknown application fields:** the public `/nodes` route returned the sign-in
page during this research. No authenticated form was inspected. Exact field
names, mandatory attachments, reviewer invitation addresses, credential-sharing
mechanism and processing time are unverified. Do not present an invented form
schema as a submission checklist.

**Unknown eligibility rule:** the inspected public submission, verification and
UX pages do not state that the underlying service must be generally available,
nor do they explicitly approve limited-access beta services. Absence of a
published restriction is not approval. Vej's README says extended workflows
need early access/deployment support and hosted batch execution is not open;
these are material review/testability limitations.

**Recommended preparation, not a verified n8n provisioning rule:** arrange a
dedicated reviewer account/API key, usable credits and scopes, a reachable
HTTPS deployment, realistic example inputs, and a clear supported-operation
matrix. Include instructions to obtain access, reproduce successes and expected
unavailable states, and revoke review access afterwards. Keep secrets out of
source, workflow exports and this document; use the submission/review channel
specified by n8n once authenticated. No account was provisioned or shared here.

## Submission blockers and open decisions

1. **Publication blocker:** publish an authorized release from GitHub Actions,
   confirm provenance and matching npm/repository identity, then run the exact
   registry scanner. The current 404 cannot be replaced by local checks.
2. **Portal blocker:** an authorized maintainer must authenticate, inspect the
   real submission form and provide its required information.
3. **Implementation readiness:** record passing declarative-action and UX checks
   described above before claiming package preparation complete.
4. **Review access blocker:** identify a reviewer-accessible deployment and
   provision supported operations/credits. Disclose unavailable beta and batch
   actions; n8n's acceptance of that scope remains unknown.

Research validation used read-only `curl` retrievals of the linked official
pages, npm metadata/artifact, GitHub scanner source, and repository source/docs.
No npm publish, portal submission, account creation, secret configuration,
external message, commit or push was performed by this workstream.
