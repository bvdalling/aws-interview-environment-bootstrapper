# Architecture

This project provisions one or more identical, short-lived **interview environments** on AWS. Each environment provides a browser-accessible IDE (`code-server`) reachable through CloudFront, and is designed to be disposable.

## What gets deployed (per stack)

At a high level, the CDK stack creates:

- **VPC**: with both public and private subnets, plus an **S3 gateway endpoint**; **private subnets** use a custom **network ACL** that blocks east-west traffic between private subnet CIDRs while still allowing ALB → instance, NAT egress, and DNS
- **S3 project bucket**: private bucket used to store the interview bundle zip that instances download on boot
- **CloudFront logs bucket**: private S3 bucket that receives standard CloudFront access logs
- **Stack termination**: an EventBridge rule + Lambda that deletes the stack at/after the configured UTC timestamp

In addition, for each configured environment (fleet entry × `count`), the stack creates:

- **EC2 instance**: runs NGINX + `code-server`, downloads the interview bundle from S3 on boot, ships logs to CloudWatch
- **Application Load Balancer (ALB)**: internet-facing, receives HTTP from CloudFront and forwards to the instance over HTTP
- **CloudFront distribution**: public HTTPS entrypoint in front of the ALB origin
- **CloudWatch Logs log group**: per-environment log group with short retention

## Request flow (end-to-end)

```mermaid
flowchart LR
  Browser[Browser] -->|HTTPS| CloudFront[CloudFront Distribution]
  CloudFront -->|HTTP to origin| Alb[ALB (public)]
  Alb -->|HTTP| Nginx[NGINX on EC2]
  Nginx -->|proxy localhost| CodeServer[code-server 127.0.0.1:8080]
```

### Why an ALB exists (instead of CloudFront directly to the instance)

This stack uses an ALB as the CloudFront origin, then forwards ALB to the instance. This provides:

- a stable origin endpoint (ALB DNS) rather than direct instance DNS
- a **REGIONAL** AWS WAF Web ACL defined alongside the ALB and associated directly to the load balancer (CloudFront-scope WAF would require global scope and deployment in us-east-1)
- an explicit security-group hop (CloudFront prefix list to ALB SG to instance SG)

## Key design choices and trade-offs

### CloudFront as the public entrypoint

CloudFront provides the public HTTPS endpoint and viewer TLS policy. Caching is disabled to avoid stale interactive sessions.

Trade-off: CloudFront is still a **public entrypoint**. This is not a private or zero-trust design.

### Network restriction (reducing origin bypass)

The stack reduces direct-to-origin access primarily via **network controls**:

- Only CloudFront origin-facing infrastructure can reach the ALB (security group ingress uses the AWS-managed CloudFront origin-facing prefix list).

This helps reduce opportunistic scanning, but it is not equivalent to strong authentication/authorization.

### `code-server` bound to localhost

`code-server` listens only on `127.0.0.1:8080`. NGINX is the only component listening on the instance network interface and proxies to `code-server` locally.

Trade-off: host compromise compromises both NGINX and `code-server`.

### Boot-time bundle download

Each instance downloads a single zip bundle from S3 and unpacks it into the ubuntu home directory.

Trade-off: whatever is in the bundle becomes part of the environment. Keep bundles minimal and assume the host is untrusted.

### Automatic teardown as a primary safety mechanism

The environment is explicitly designed to be ephemeral, and auto-deletes the CloudFormation stack at a configured UTC timestamp.

Trade-off: by design, resources (including logs, unless exported) are not retained long-term.

