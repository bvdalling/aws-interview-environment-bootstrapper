# Getting started

This guide walks you through provisioning one or more interview environments in a **non-sensitive AWS account** and connecting to `code-server` through CloudFront.

## What you get after deploy

For each configured environment, CDK provisions:

- a **CloudFront URL** you can open in a browser
- an **EC2 host** running NGINX and `code-server`
- an **automatic teardown schedule** so the stack deletes itself at `terminationDateUtc`

## Critical safety warning

- **Do not deploy this into any sensitive AWS account.** That includes production, shared, regulated, or security accounts, or any account with real data or meaningful IAM/users/roles.
- **Best practice is a fresh AWS account** with nothing deployed or configured in it (beyond what CDK bootstrap creates), used only for this temporary environment, then discarded.

For the full threat model and control mapping, see [Security](./security.md).

## Prerequisites

- **Node.js + npm**
- **AWS credentials** with permissions to deploy CDK stacks (CloudFormation, IAM, EC2, VPC, S3, CloudFront, Lambda, EventBridge, CloudWatch Logs, SSM)
- **AWS CDK v2** (installed via the `infra` package dependencies)
- A target AWS **account/region** (CDK uses `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION`)

## Quickstart (deploy)

1. Install dependencies:

```bash
cd infra
npm install
```

2. Configure your environments in `infra/config.ts`:
   - Add one or more fleet entries to `appConfig.fleets` (it may be commented out initially).
   - Set a **strong** `codeServerPassword`.
   - Set a `projectZipKey` (see [Interview bundle](#interview-bundle) below).
   - Set `terminationDateUtc` (see [Automatic teardown](#automatic-teardown)).

3. Bootstrap CDK (first time per account/region):

```bash
cd infra
npx cdk bootstrap
```

4. Deploy:

```bash
cd infra
npx cdk deploy
```

5. After deploy completes, CDK prints outputs including:
   - `ProjectBucketName`
   - `SharedCloudFrontUrl` (the CloudFront domain)
   - `EnvironmentUrl-<fleet>-<index>-<token>` (one per environment)

Open the `EnvironmentUrl-...` in your browser and log in to `code-server` using your `codeServerPassword`.

## Configuration overview (`infra/config.ts`)

All configuration is in `infra/config.ts` as `appConfig`.

### Fleets (`appConfig.fleets`)

Each fleet creates `count` identical environments:

- **`name`**: label used in tags and outputs
- **`count`**: number of environments to create
- **`instanceType`**: e.g. `t3.micro`
- **`volumeSizeGiB`**: EBS root volume size
- **`codeServerPassword`**: password for `code-server`
- **`projectZipKey`**: S3 object key for the interview bundle zip (downloaded at boot)

### VPC (`appConfig.vpc`)

Creates a VPC used by the environments. The stack also adds an **S3 gateway endpoint** so instances can reach S3 without requiring a public S3 path.

### AMI (`appConfig.amiParameterPath`)

EC2 uses an AMI ID looked up from SSM Parameter Store (Ubuntu by default).

## Interview bundle

On first boot, each instance runs a script that:

- downloads `s3://<ProjectBucketName>/<projectZipKey>` to `/home/ubuntu/interview.zip`
- unzips to `/home/ubuntu/interview/`

The script template is `infra/scripts/fetch-interview-bundle.sh`.

### What gets uploaded to S3 (and how to pick `projectZipKey`)

The CDK stack deploys an asset from the local `./interview` directory into the S3 bucket under a `bundles/interview/` prefix.

Because the exact object key can depend on how the asset is packaged, the safest way to set `projectZipKey` is:

1. Deploy once (even with an empty fleet if you want to just create the bucket), then capture the `ProjectBucketName` output.
2. List what was uploaded:

```bash
aws s3 ls "s3://<ProjectBucketName>/bundles/interview/"
```

3. Set `appConfig.fleets[].projectZipKey` to the key you want instances to download (e.g. `bundles/interview/<something>.zip`).
4. Redeploy.

## Automatic teardown

This environment is designed to **self-destruct** by deleting the CloudFormation stack at `appConfig.terminationDateUtc`.

- **Where**: `infra/config.ts` → `appConfig.terminationDateUtc`
- **Format**: ISO 8601 UTC string that must end in `Z`, e.g. `2026-03-31T23:59:00Z`
- **Behavior**: at (or shortly after) the configured time, an EventBridge rule invokes a Lambda which calls `DeleteStack` on the stack.

If the configured time is already in the past at deploy time, the stack schedules teardown a few minutes in the future.

