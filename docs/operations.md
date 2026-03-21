# Operations

This page covers **Sandcastle** operational workflows you will use most: finding outputs, forcing recreation, and understanding teardown behavior.

## Outputs you will use

After `npx cdk deploy`, the stack prints outputs including:

- **`ProjectBucketName`**: S3 bucket where the workspace bundle object lives
- **`SharedCloudFrontUrl`**: the CloudFront domain
- **`EnvironmentUrl-<fleet>-<index>-<token>`**: the viewer HTTPS URL for each environment
- **`InstanceId-<fleet>-<index>-<token>`**: the EC2 instance ID for each environment

## Redeploy / recreate environments

If you need to force fresh per-environment resources (new instance, new distribution) without changing construct IDs manually, use:

```bash
cd infra
npm run redeploy
```

This bumps `INSTANCE_RECREATE_TOKEN`, which is incorporated into per-environment resource IDs and forces replacement.

## Automatic teardown (how it behaves)

The stack is designed to delete itself at `appConfig.terminationDateUtc`.

- If `terminationDateUtc` is **in the future**, teardown is scheduled for that time.
- If `terminationDateUtc` is **in the past** at deploy time, teardown is scheduled a few minutes in the future (to ensure the scheduler still executes).

Operational guidance:

- Prefer **short lifetimes** and manual deletion as soon as you are done.
- Avoid changing termination times casually. Treat teardown as a safety boundary.

## Logging and retention

- **CloudFront access logs**: delivered to an S3 logs bucket under the shared prefix `cloudfront-access-logs/shared/` (filter by request path `/env-<routeGuid>/` to isolate an environment).
- **Instance logs**: shipped to a per-environment CloudWatch log group under `/interview/<fleet>-<index>-<token>`.
- **Retention**: the per-environment log group is configured with **one week** retention.

## Access model (practical)

- Viewers connect to the CloudFront URL over HTTPS.
- `code-server` authentication is **password-based** using `codeServerPassword` from `infra/config.ts`.
- Treat the password like a secret and rotate it per session.

