# Validation record

## Form builder release v0.2.0

Validated 2026-10-19 on the same **db-xps-02** host and toolchain described below, in `/home/lode/Projects/Lode/vej-n8n-node`, branch `main`. Checks ran on the working tree prepared for `v0.2.0`; that release tag identifies the final source revision.

- `bun run check`: passed, including **77 tests**, type checking, strict official n8n lint, compilation, and package checks.
- `bun pm pack --destination artifacts`: passed for `n8n-nodes-vej-0.2.0.tgz`.
- `bun run test:n8n`: passed for all **33 actions** using version 1 JSON inputs.
- `bun run test:n8n:forms`: passed for all **33 actions** using version 2 form inputs, without a hidden legacy JSON payload.
- `bun run test:n8n:package`: passed for all **33 actions** using version 2 forms from the installed release tarball.
- `bun run test:n8n:cloud`: passed for the built-in-node Choice starter against the local API fixture, with no Vej custom node loaded. This ran in local n8n **2.43.8**, not an actual Cloud account.
- Browser inspection in n8n **2.43.8** confirmed repeatable outcome controls, the **Add Outcome** action, nested record fields, boolean toggles, numbers, and null values. The README screenshot shows the version 2 form.
- Both GitHub Actions workflow files parse as YAML. The npm publishing workflow is manual and was not run.

An independent read-only **GPT-6 Astra** review checked native n8n parameter normalization, all 18 body-form defaults, version compatibility, Cloud instructions, and publishing setup. It found a numeric-looking Choice-name edge case in calibration labels. Forms now ask for the reviewed outcome key and map it to the emitted outcome order. A regression test and independent recheck confirmed the fix.

The 16 numbered examples now use version 2 forms. A separate Cloud Choice starter uses only built-in nodes. All transport tests use the pinned Docker image and fake credentials described below. No live inference, npm publication, or n8n verification was performed.

To reproduce the form release checks, run the commands below and additionally `bun run test:n8n:forms` and `bun run test:n8n:cloud`. The extra smoke directories are `artifacts/n8n-smoke-forms` and `artifacts/n8n-smoke-cloud`.

## Initial release v0.1.0

Validated 2026-10-19 on **db-xps-02** (fleet identity `lk-db-xps-02`), Linux x86_64, Intel Core i7-11800H (16 logical CPUs), approximately 31 GiB RAM. Checkout: `/home/lode/Projects/Lode/vej-n8n-node`, branch `main`. Checks ran on the working tree prepared for the initial `v0.1.0` release; the release tag identifies the final source revision. No GPU was used.

Toolchain: Bun **1.4.3**, TypeScript **5.9.3**, official `@n8n/node-cli` **0.52.6**, `n8n-workflow` **2.43.5**. Compiled entrypoints also load under Node **24.19.0**. Dependencies are locked in `bun.lock`.

## Results

- `bun run check`: passed. Includes TypeScript checking, official strict n8n lint, Bun tests, the official n8n compiler, and compiled entrypoint/metadata/icon/dependency checks.
- `bun pm pack --destination artifacts`: passed. Produces `n8n-nodes-vej-0.1.0.tgz`, including compiled nodes/credentials, both icon variants, discovery metadata, authored input defaults, branding, license notices, documentation, and 16 example workflows.
- `bun run test:n8n`: passed. n8n **2.43.8** imported credentials/workflow and executed **all 33 actions** using its real authenticated HTTP helper against a local Bun fixture, loading compiled files from a custom directory.
- `bun run test:n8n:package`: passed. Bun installed the compiled tarball into an isolated n8n community-package directory using `--ignore-scripts`; n8n executed all **33 actions** again under the package type `n8n-nodes-vej.vej`.

The n8n image was `docker.n8n.io/n8nio/n8n:2.43.8`, pulled with digest `sha256:a18edcf018198b33b5488fb47ededafe11e0b10d28f65b9535b7c447c9ce3b2c`. Smoke containers are disposable. They use host networking only to reach the loopback-bound local API fixture; they publish no ports and run no persistent service. The fixture receives fake credentials only.

The smoke test checks actual HTTP methods, paths, mode envelopes, Bearer authentication, 204 handling, and response propagation. Unit tests additionally validate all authored defaults against request-schema snapshots, per-item parameters and output pairing, explicit retention, sequence checks, invalid JSON/numbers, and preservation of normalized n8n error statuses without exposing transport credentials.

The API request-schema components in `tests/contracts` are pinned to Vej revision **`dedb60477c1c6b323658195ee96bc34e9e5fbe6f`**, source paths `api/openapi/v1.json` and `api/openapi/v1beta.json`. Only reachable request-schema components were retained. Integration input examples were authored separately. These are contract fixtures, not training, calibration, or evaluation data.

## Review

An independent read-only **GPT-6 Astra** review found that normalized n8n `NodeApiError` exceptions initially lost HTTP status and diagnostic detail. The implementation now retains sanitized status/description, discards transport causes, redacts key values, and includes a regression fixture. A first Claude Sonnet review attempt ended at the provider rate limit and supplied no review evidence.

## Reproduce

```bash
bun install --frozen-lockfile
bun run check
bun pm pack --destination artifacts
bun run test:n8n
bun run test:n8n:package
```

The last two commands require Docker and permission to run the pinned-version n8n image. Generated SQLite databases, fake credentials, HTTP traces, logs, and package installations stay under ignored `artifacts/`. Keep that directory local; it is not a release asset. Remove a smoke test's `artifacts/n8n-smoke` or `artifacts/n8n-smoke-package` directory if you need a fresh database.

## Limits

No live hosted Vej inference, production credentials, retained customer content, paid service calls, model-quality evaluation, or npm publication were used. Transport fixtures do not validate calibration, factual accuracy, ranking quality, or deployment availability. n8n Cloud verification is pending. The hosted Beta and batch limitations documented on Vej's website remain in effect.
