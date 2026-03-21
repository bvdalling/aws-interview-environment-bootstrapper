# Sandcastle

Run it. Test it. Erase it.

**Sandcastle** provisions **temporary, disposable workspaces** on AWS using **AWS CDK (TypeScript)** for interviews, workshops, and live coding. Each workspace is an EC2 instance running **`code-server`** (VS Code in the browser) behind **NGINX**, an **ALB**, and **CloudFront**, with automatic teardown.

## Start here

- **[Getting started](./getting-started.md)**: prerequisites, deploy steps, and first login
- **[Configuring code-server](./code-server.md)**: fleet settings in `infra/config.ts`, workspace path, password, and **Open VSX** extensions
- **[Architecture](./architecture.md)**: what gets deployed, request flow, and why it is built this way
- **[Security officer briefing](./security-officer-briefing.md)**: executive summary, risk posture, and approval guidance
- **[Security](./security.md)**: threat model, controls, blast radius, and operator guidance
- **[Operations](./operations.md)**: redeploy semantics, teardown behavior, and common workflows
- **[Troubleshooting](./troubleshooting.md)**: where to look when something fails

## Where the code lives

- **`infra/`**: AWS CDK app (TypeScript) that provisions AWS resources
- **`interview/`**: workspace bundle source directory. Content packaged and uploaded for instances to download on first boot (path name is historical; see [Workspace bundle](./getting-started.md#workspace-bundle))
