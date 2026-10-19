# Install Vej for n8n

Use a self-hosted n8n instance. This package is not yet published on npm or verified for n8n Cloud. A GitHub push alone does not make a package installable through n8n's community-node search.

The development toolchain uses **Bun 1.4.3**. The integration emits CommonJS and runs inside n8n's supported runtime; installing this node does not replace n8n's runtime with Bun. The tested n8n version is **2.43.8**; older releases are not claimed compatible.

## Option 1: build and copy

On a machine with Bun:

```bash
git clone https://github.com/LodeKennes/vej-n8n-node.git
cd vej-n8n-node
bun install --frozen-lockfile
bun run build
```

For a local n8n installation, run as the user that owns its data directory:

```bash
mkdir -p ~/.n8n/custom
cp -R dist/nodes dist/credentials ~/.n8n/custom/
```

Restart n8n and search the node picker for **Vej**. If your n8n data directory is elsewhere, copy into its `custom` directory or set `N8N_CUSTOM_EXTENSIONS` to the absolute directory containing the compiled `nodes` and `credentials` folders. Preserve both folders and their relative paths; the credential icons reference the node icons.

For this custom-directory method, run `bun run examples:custom` and import the matching workflows from `artifacts/custom-examples`. n8n registers copied nodes as `CUSTOM.vej`; the committed examples target the community-package installation instead. Restart the container after rebuilding a bind-mounted `dist` directory so it uses the new files.

## Option 2: install the release package

The GitHub release includes a compiled `n8n-nodes-vej-0.3.0.tgz`; building locally is optional. On the n8n host, as the account owning the n8n data directory:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
test -f package.json || printf '{"private":true}\n' > package.json
bun add --ignore-scripts \
  https://github.com/LodeKennes/vej-n8n-node/releases/download/v0.3.0/n8n-nodes-vej-0.3.0.tgz
```

Restart n8n. Community package loading must be enabled; if your deployment disables it with `N8N_COMMUNITY_PACKAGES_ENABLED=false`, use the custom-directory method instead. Install in the data directory used by the n8n process, not a different user's home. Choose one installation method so the same node is not loaded twice.

## Docker Compose

Build on the host with Bun, then add the compiled folders to your existing n8n service's volumes:

```yaml
services:
  n8n:
    # Keep your existing image, data volume, and configuration.
    volumes:
      - ./vej-n8n-node/dist/nodes:/home/node/.n8n/custom/nodes:ro
      - ./vej-n8n-node/dist/credentials:/home/node/.n8n/custom/credentials:ro
```

The paths on the left are relative to your Compose file. Keep both mounts. Recreate your n8n service using your normal deployment command. In queue mode, install the same compiled node on the main instance and every worker. No Bun installation is needed inside the n8n container when mounting compiled files.

## Connect your Vej account

1. Request or sign in to your account at [app.itsvej.com](https://app.itsvej.com/), obtain model access, and create an API key with the scopes needed for your actions.
2. In n8n, create a **Vej API** credential.
3. Set **API URL** to `https://api.itsvej.com` and **API Key** to your `vej_sk_…` key. The URL is the service root, without `/v1` or `/v1beta`.
4. Save and test. The test calls `GET /v1/me`; it performs no model inference.
5. Add a Vej node, choose a resource/operation, and select the credential.

Credentials use n8n's encrypted credential store. No key belongs in a workflow JSON file. Only point the credential at a server you trust; that server receives the key and inference input. HTTPS is expected for hosted services. Redirects are disabled for node requests.

For a trusted local `vej serve` instance without authentication, use its reachable service URL and leave the key blank. The core `/v1/predict` actions can work there; the account credential test may return 404 because `/v1/me` belongs to the gateway. Local and hosted deployments may expose different Beta capabilities. In Docker, `localhost` refers to the container; use a reachable Vej service name or the host address configured by your deployment.

## Try an example

Download a JSON file from [examples](../examples/README.md), then use n8n's **Import from File**. Select your Vej credential on each Vej node before running. Examples are inactive and contain no credentials. The notes on each example explain placeholders and Beta requirements.

## Upgrade from v0.1.0

Install the v0.3.0 tarball using the same method, then restart n8n. Existing Vej nodes retain node version 1 and their saved JSON behavior. Add a new Vej node to use version 2's form builder. The numbered examples now target version 2. Advanced JSON remains available as an input method on version 2 for full or bulk payloads.

Version 0.3.0 uses declarative REST routing for both node versions. Version 2 adds deletion confirmations and optional Simplify/AI-tool output controls for larger responses. Raw output remains the default, so existing form workflows retain full responses. Version 1 retains its empty deletion response.

## n8n Cloud

Unverified community packages cannot be installed on n8n Cloud. This node needs npm publication with GitHub Actions provenance and approval through the n8n Creator Portal before an owner/admin can install it from the node picker. The publishing workflow is prepared but has not been run. [Cloud instructions and submission steps](n8n-cloud.md).

To use Vej on Cloud now, import [cloud-choice.json](../examples/cloud-choice.json), edit its ordinary fields, and select a Header Auth credential. It uses only built-in nodes and does not require this package to be installed.

Sources: [n8n community installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management.md), [private node installation](https://docs.n8n.io/connect/create-nodes/deploy-your-node/install-private-nodes.md), [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md). Checked 2026-10-19.
