# Contributing

Use Bun and the committed `bun.lock`. Keep runtime dependencies at zero; n8n supplies `n8n-workflow`. Build/test tooling belongs in `devDependencies`.

```bash
bun install --frozen-lockfile
bun run check
```

`nodes/Vej/operations.ts` defines the 33 actions and routes. `presets.json` contains authored input examples. `request.ts` builds and validates requests; `Vej.node.ts` owns n8n parameter/execution behavior. `credentials/VejApi.credentials.ts` owns authentication.

API additions need a matching operation, useful input default, request-contract test, example, and documentation. Preserve response metadata and usage; keep unavailable and abstained results visible. Never enable retention as an inference side effect or retry state writes automatically. Model quality claims need their own measured evidence.

The official n8n linter configuration remains unchanged and strict. A few documented inline exceptions apply only to Bun test imports, pure validation boundaries, and generated parameter defaults. No runtime code reads files or environment variables. Bun-only build scripts use `.mts`; they are excluded from the published package.

Before release, run the checks, inspect the packed file list, and test the compiled package in the target n8n version. Publish to npm only through a provenance-enabled GitHub Actions workflow after configuring ownership/trusted publishing; repository pushes do not publish to npm. This repository's CI builds and uploads a tarball, and does not publish it automatically.
