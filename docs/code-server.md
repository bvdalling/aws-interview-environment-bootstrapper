# Configuring code-server

Each environment runs **[code-server](https://github.com/coder/code-server)** (VS Code in the browser) on the EC2 instance. It is installed and configured during instance **user-data** using a script rendered from [`infra/scripts/setup-code-server.sh`](../infra/scripts/setup-code-server.sh). NGINX terminates TLS at the load balancer edge and proxies to code-server on `127.0.0.1:8080` with a **per-environment path prefix** so multiple environments can share one CloudFront distribution.

This page describes what you can configure from **`infra/config.ts`** and how extensions relate to **Open VSX**.

## Where to configure

All fleet-level code-server settings live on each entry under **`appConfig.fleets`** in [`infra/config.ts`](../infra/config.ts) (`InterviewFleetConfig`).

| Field | Purpose |
|-------|---------|
| **`codeServerPassword`** | Initial password for the browser login. Stored in **AWS Secrets Manager** (not embedded in user-data); the instance reads it at setup time. Change the secret in the console or rotate after deploy if you need a different password without redeploying user-data. |
| **`codeServerExtensions`** | List of extension identifiers to **pre-install** at boot (see [Extensions (Open VSX)](#extensions-open-vsx) below). |
| **`codeServerWorkspaceFolder`** | Absolute directory code-server opens as the workspace. It must match where the workspace bundle is unpacked; by default **`/home/ubuntu/interview`**, consistent with [`fetch-interview-bundle.sh`](../infra/scripts/fetch-interview-bundle.sh). |
| **`projectZipKey`** | S3 object key for the zip the instance downloads before code-server starts; contents end up under the workspace folder. See [Workspace bundle](./getting-started.md#workspace-bundle). |

Password, workspace path, extension list, and CloudFront hostname are stitched into the rendered setup script in [`infra/lib/templates.ts`](../infra/lib/templates.ts) (`renderCodeServerScript`).

## Extensions (Open VSX)

code-server does **not** use the **Visual Studio Marketplace** the same way desktop VS Code does. It installs extensions from the **[Open VSX Registry](https://open-vsx.org/)**, an open, vendor-neutral registry used by VS Code-compatible editors in the open-source ecosystem.

- **Use Open VSX extension ids** in `codeServerExtensions`, in the form **`publisher.extension`** (for example `ms-python.python`, `vue.volar`, `dbaeumer.vscode-eslint`). Browse and verify ids on [open-vsx.org](https://open-vsx.org/).
- **Microsoft Marketplace-only** extensions may be **missing or outdated** on Open VSX. If an extension does not install or behaves differently than on desktop VS Code, check whether it exists on Open VSX under the same id or an alternative publisher.
- **Empty list**: set `codeServerExtensions: []` to skip pre-install; users can still install extensions from the UI **if** those extensions are available on Open VSX.

At boot, the rendered script runs `code-server --install-extension` for each id as the `ubuntu` user (see `renderCodeServerExtensionInstallBlock` in [`infra/lib/templates.ts`](../infra/lib/templates.ts)).

## After you change configuration

- **`codeServerExtensions`** or **`codeServerWorkspaceFolder`**: change [`infra/config.ts`](../infra/config.ts) and **redeploy** so new instances get updated user-data. Existing instances keep the old script until replaced.
- **`codeServerPassword`**: updating the value in config and redeploying updates the **Secrets Manager** secret; **new** instances pick it up. For **running** instances, update the secret value in AWS and **restart** code-server on the instance (or replace the instance) so the process reads the new password. See [Operations](./operations.md) for recreate/redeploy patterns.

## Related documentation

- [Getting started](./getting-started.md): deploy flow and workspace bundle layout
- [Architecture](./architecture.md): NGINX path prefix, CloudFront → ALB → code-server flow
- [Troubleshooting](./troubleshooting.md): if code-server fails to start or extensions fail to install
