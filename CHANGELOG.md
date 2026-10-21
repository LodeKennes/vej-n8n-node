# Changelog

## 0.4.0

- Add Workflow → Extract Typed Fields for `POST /v1beta/extract`, with all seven field types, repeatable form rows, number options, reference dates, and Advanced JSON.
- Preserve extraction values, guesses, null probabilities, confidence, evidence spans, metadata, and usage; surface unavailable deployments without fallback.
- Include an invoice extraction workflow, pinned API contracts, and real n8n transport checks.

## 0.3.1

- Run disposable n8n test containers with the invoking user's UID/GID so fixture directories work on GitHub-hosted runners as well as local machines.
- Include bounded command diagnostics when integration fixtures fail. The node runtime is unchanged from 0.3.0.

## 0.3.0

- Prepare n8n verification materials: listing copy, brand assets, reviewer walkthrough, access/scope requirements, and publication/submission checklist.
- Use declarative REST routing with the existing native forms and saved version 1 input support.
- Add version 2 deletion confirmations and sentence-case operation actions.
- Add Simplify and AI-tool output controls for larger Beta responses, keeping raw output as the default.
- Gate source and packed JavaScript with the pinned official marketplace scanner, including when inline lint exceptions are disabled.
- Extend real n8n integration checks and prepare strict registry/provenance verification after npm publication.

## 0.2.0

- Add native form builders, repeatable questions and typed record fields.
- Preserve version 1 JSON workflows and offer optional Advanced JSON on version 2.
- Add a built-in-node Cloud Choice starter and Cloud publishing instructions.

## 0.1.0

- Initial Bun-based integration: 33 Vej actions, 16 example workflows, credentials, official branding, and installation documentation.
