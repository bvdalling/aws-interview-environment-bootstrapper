# Interview environment docs

This repository provisions **temporary, disposable interview environments** on AWS using **AWS CDK (TypeScript)**.
Each environment is an EC2 instance running **`code-server`** (VS Code in the browser) behind **NGINX**, an **ALB**, and **CloudFront**, with automatic teardown.

## Start here

- **[Getting started](./getting-started.md)**: prerequisites, deploy steps, and first login
- **[Architecture](./architecture.md)**: what gets deployed, request flow, and why it is built this way
- **[Security officer briefing](./security-officer-briefing.md)**: executive summary, risk posture, and approval guidance
- **[Security](./security.md)**: threat model, controls, blast radius, and operator guidance
- **[Operations](./operations.md)**: redeploy semantics, teardown behavior, and common workflows
- **[Troubleshooting](./troubleshooting.md)**: where to look when something fails

## Where the code lives

- **`infra/`**: AWS CDK app (TypeScript) that provisions AWS resources
- **`interview/`**: local interview bundle content that is packaged and uploaded for instances to download on first boot

