# Security officer briefing (executive summary)

## What this is

**Sandcastle** provisions a **temporary workspace** in AWS. It is designed to be **disposable**, **time-bounded**, and **safer than exposing an EC2 instance directly**. It is not intended to meet production or regulated security standards.

The workspace provides a browser-based IDE (`code-server`) for interviews, workshops, and live sessions, delivered through CloudFront, backed by an ALB and a single EC2 host.

## Non-negotiable deployment constraints

- **Do not deploy into any sensitive AWS account.** Use a fresh, isolated AWS account with no other workloads or data.
- **Do not use real secrets or sensitive data** in the environment (terminals, files, clipboard, or pasted content).
- **Keep lifetimes short.** Set an aggressive `terminationDateUtc` and delete the stack manually as soon as you are done.

If these constraints are not acceptable, the correct outcome is **do not deploy** this system.

## Architecture at a glance

Request path:

- Browser connects to **CloudFront (HTTPS)**
- CloudFront forwards to an **internet-facing ALB (HTTP origin)**
- ALB forwards to **NGINX on EC2**
- NGINX proxies to **`code-server` on localhost**

The workspace downloads a **workspace bundle** zip from a private S3 bucket during boot and unpacks it onto the host.

## Threat model summary

This is a public, internet-reachable endpoint that provides interactive compute. The primary risks are:

- **Credential compromise** (the `code-server` password is obtained)
- **Software vulnerabilities** (in `code-server`, NGINX, or OS packages)
- **Supply chain risks at boot** (packages and install scripts fetched at first boot)
- **Malicious or unsafe bundle contents**
- **Accidental data leakage** (particularly via logs or copy/paste)

## Implemented controls (what the code does today)

Controls are designed to reduce opportunistic access and constrain AWS API blast radius. Highlights:

- **Reduced origin bypass**
  - ALB ingress is restricted to the AWS-managed CloudFront origin-facing prefix list.
  - Instance ingress is restricted to the ALB security group.
  - NGINX enforces a per-environment secret origin header injected by CloudFront.
- **Service exposure reduction**
  - `code-server` binds to `127.0.0.1:8080` and is only reachable through NGINX.
- **Baseline edge hygiene**
  - Viewer traffic is redirected to HTTPS.
  - CloudFront access logs are enabled and delivered to S3 with lifecycle expiration.
- **Least privilege by design (limited, not zero)**
  - The EC2 instance role is intentionally narrow (scoped S3 reads for the bundle object, scoped CloudWatch Logs writes, and SSM management).
- **Time-bounding**
  - Automatic teardown deletes the CloudFormation stack at `terminationDateUtc`.
  - The stack refuses termination dates more than 365 days into the future.

## Blast radius statement

If the public host is compromised, the attacker gets control of the **Sandcastle workspace** (interactive shell and filesystem). This does **not automatically** grant broad access to the AWS account.

However, a compromised host can use whatever limited AWS permissions and network access the instance has. In this design, that is intentionally narrow. The account-level mitigation is still **fresh account isolation**.

## Residual risks and explicit non-goals

This project intentionally does not provide:

- Strong identity and access management for end users (it is password-based)
- MFA or SSO
- Private network access only or zero-trust posture
- A pinned, high-assurance supply chain for boot-time installs
- Forensic durability (resources are destroyed on teardown; logs have limited retention)

## Operational requirements (what operators must do)

- Use a fresh account dedicated to Sandcastle.
- Set a strong, unique `codeServerPassword` per session.
- Set a short `terminationDateUtc` and delete the stack as soon as the session ends.
- Keep the workspace bundle minimal and reviewed.
- Treat the environment as untrusted compute. Do not connect it to internal systems.

## Decision guidance

- **Approve for use** only as a short-lived sandbox in an isolated account, with no sensitive data, and with enforced teardown.
- **Do not approve** for production, shared, regulated, or security accounts, or any use case requiring strong authentication, data protection assurances, or supply chain guarantees.
