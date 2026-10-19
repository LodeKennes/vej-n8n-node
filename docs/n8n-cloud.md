# Using Vej on n8n Cloud

The Vej community node is **not yet published on npm or verified by n8n**. n8n Cloud does not accept an unverified GitHub package, release tarball, or custom-directory installation. A public GitHub repository and passing lint do not grant Cloud availability.

## Use Vej on Cloud today

Import [cloud-choice.json](../examples/cloud-choice.json). It uses only n8n's built-in Manual Trigger, Edit Fields, and HTTP Request nodes, so the custom Vej node is not required.

1. In **Describe the decision**, edit the state, question, and outcome names/descriptions using the ordinary field controls.
2. Create a built-in **Header Auth** credential with **Name** `Authorization` and **Value** `Bearer YOUR_VEJ_API_KEY`, then select it in **Ask Vej**.
3. Run the example. The HTTP node's request expression is already configured; there is no JSON body to author. The result uses `answers.result.choice` and `answers.result.probabilities`.

This is a two-outcome Choice starter, not the full community node. Extend its fields or use Vej's published API documentation for other modes. The hosted endpoint must be reachable from n8n Cloud, and model/API access is still required.

## Make the full node installable on Cloud

The maintainer must complete these steps:

1. **Publish `n8n-nodes-vej` to npm from GitHub Actions with provenance.** `.github/workflows/publish.yml` is prepared for this. Bun handles dependencies, tests, builds, and packing. The final registry upload uses npm because Bun cannot currently generate provenance statements.
2. **Configure publishing authority.** For an initial package publication, supply an appropriately scoped npm granular access token through the repository's `NPM_TOKEN` Actions secret. Do not put it in source files or chat. Once the package exists, configure npm trusted publishing for owner `LodeKennes`, repository `vej-n8n-node`, workflow filename `publish.yml`; omit the token to use OIDC. Follow npm's current package/account setup requirements.
3. **Run Publish to npm explicitly from a release tag**, such as `v0.2.0`. The workflow checks that the tag matches `package.json`. In GitHub Actions select the tag in **Use workflow from**, or run `gh workflow run publish.yml --ref v0.2.0`. The checked-out source and provenance refer to that tag's commit. A normal push or release does not publish to npm.
4. **Submit through the [n8n Creator Portal](https://creators.n8n.io/nodes)** using the public repository and npm package. n8n reviews technical requirements, documentation, and UX. Approval and timing are controlled by n8n; they cannot be guaranteed by this repository.

This repository has an MIT integration license, no shipped runtime dependencies, the official strict n8n linter, credential testing, documentation, branding, and native form controls. Those are preparation for review, not a claim that n8n has approved it. This update does not publish to npm, configure external credentials, or submit a Creator Portal application.

## Install after n8n approves it

1. As the Cloud instance owner, enable verified community nodes in the **Cloud Admin Panel** if they are disabled.
2. An instance owner or admin opens the workflow canvas, selects **+**, and searches for **Vej**.
3. Select the Vej entry under **More from the community**, then select **Install**.
4. Add the node, configure its Vej API credential, and use the form controls. Other instance members can use it once installed.

Sources checked 2026-10-19: [n8n submission and provenance requirements](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/), [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/), [Cloud installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/install-verified-community-nodes/), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), and [Bun publishing limitations](https://bun.sh/docs/pm/cli/publish).
