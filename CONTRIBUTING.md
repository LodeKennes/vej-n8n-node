# Contributing

Use Bun and the committed `bun.lock`. Keep runtime dependencies at zero; n8n supplies `n8n-workflow`. Build/test tooling belongs in `devDependencies`.

```bash
bun install --frozen-lockfile
bun run check
```

`nodes/Vej/operations.ts` defines the 33 actions and routes. `presets.json` contains authored input examples. `forms.ts` defines native form fields; `form-input.ts` assembles their typed values. `request.ts` validates requests; `Vej.node.ts` declares the UI and declarative routing. `routing.ts` supplies request/response hooks and version compatibility. `credentials/VejApi.credentials.ts` owns authentication.

API additions need a matching operation, useful input default, request-contract test, example, and documentation. Preserve response metadata and usage; keep unavailable and abstained results visible. Never enable retention as an inference side effect or retry state writes automatically. Model quality claims need their own measured evidence.

The official n8n linter configuration remains unchanged and strict. Runtime source has no inline lint exceptions; test-only exceptions cover Bun imports and preservation of hook errors. No runtime code reads files or environment variables. Bun-only build scripts use `.mts`; they are excluded from the published package. Build invokes the pinned TypeScript compiler explicitly and uses the official node CLI asset copier, avoiding the scanner's competing TypeScript alias binary.

Before release, run the checks, inspect the packed file list, and test the compiled package in the target n8n version. Publish to npm only through a provenance-enabled GitHub Actions workflow after configuring ownership/trusted publishing; repository pushes do not publish to npm. This repository's CI builds and uploads a tarball, and does not publish it automatically.

Run `bun pm pack --destination artifacts` followed by `bun run scan:local` to scan source and packed JavaScript with the pinned official analyzer and inline exceptions disabled. After publication, `bun run scan:registry` also verifies npm provenance, attested source retrieval, and the registry artifact; it fails on `passed: false` even where the upstream CLI exits zero.

The prepared `publish.yml` workflow is manual-only and must run from the matching version tag. It uses Bun for install/check/build/pack and npm only for the provenance-enabled registry upload. It runs the installed-package n8n smoke test and local scanner before publication, then the registry scanner afterwards. Read [the review kit](docs/n8n-review.md) and [Cloud guide](docs/n8n-cloud.md) before configuring npm publishing or submitting for verification.
