# Validation record

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
