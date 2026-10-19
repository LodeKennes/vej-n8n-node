# Example workflows

Import any JSON file through n8n's **Import from File**, select your **Vej API** credential on every Vej node, inspect its input, and execute manually. All examples are inactive, contain no keys, and run no downstream external actions.

- `01`–`04`: guided Choice, Noul, Score, and mixed independent native questions.
- `05`–`15`: each of the 11 [Vej use cases](https://itsvej.com/use-cases/), with matching action names.
- `16`: calibration fitting, which supports the risk workflow.

`09-watch-a-conversation.json` creates a state and appends a message using expressions for the returned `id` and `seq`. Explicit states retention consent is a prerequisite; the example never enables it for you. Select credentials on both Vej nodes. Never enable automatic retry on conversation writes.

Risk/calibration/feedback examples illustrate JSON structure. Their digests, labels, logits, and tokens are placeholders; replace them with your own data. The small fixtures cannot qualify risk thresholds. Rankings have a failed Beta quality gate. Effort defaults to standard; fast/careful are unavailable. See [operations](../docs/operations.md) for interpretation and current limitations.

## Package installation versus custom-directory installation

The committed examples use the community package type `n8n-nodes-vej.vej`. If you installed by copying `dist/nodes` and `dist/credentials` to n8n's `custom` directory, n8n registers the type as **`CUSTOM.vej`** instead. Generate matching examples with Bun:

```bash
bun run examples:custom
```

Import from the generated `artifacts/custom-examples` directory. This changes only the node type; the requests and operations are the same. For a tarball installed in `~/.n8n/nodes`, use the committed examples directly.
