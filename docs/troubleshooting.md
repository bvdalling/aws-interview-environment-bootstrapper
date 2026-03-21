# Troubleshooting

Use this guide when a **Sandcastle** workspace or deploy step misbehaves.

## Instance never becomes usable

- Start with **CloudWatch Logs** for the per-environment log group:
  - `/interview/<fleet>-<index>-<token>`
- Key log files shipped include:
  - `/var/log/user-data.log`
  - `/var/log/cloud-init.log`
  - `/var/log/cloud-init-output.log`
  - `/var/log/nginx/error.log`

## Bundle download fails (S3 404 / unzip errors)

Common causes:

- `projectZipKey` does not match an existing object key in the project bucket.

How to verify:

1. Capture the `ProjectBucketName` output from CDK.
2. List what exists under the uploaded prefix:

```bash
aws s3 ls "s3://<ProjectBucketName>/bundles/interview/"
```

Then set `appConfig.fleets[].projectZipKey` to the exact key you want the instances to download (for example, `bundles/interview/<something>.zip`) and redeploy.

## Deploy errors about termination date

- Ensure `terminationDateUtc` is valid ISO 8601 **and** ends with `Z` (explicit UTC), for example:
  - `2026-03-31T23:59:00Z`

## Notes on secrets

- `codeServerPassword` lives in source control if you commit it. Treat it like a secret.
- Prefer short-lived passwords and rely on automatic teardown to limit exposure.

