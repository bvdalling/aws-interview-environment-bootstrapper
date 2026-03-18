hello

## Automatic teardown

This environment is configured to **self-destruct** by deleting the CloudFormation stack at `terminationDateUtc`.

- **Config**: `infra/config.ts` → `appConfig.terminationDateUtc`
- **Format**: ISO 8601 UTC (must end in `Z`), e.g. `2026-03-31T23:59:00Z`
- **Behavior**: at (or shortly after) the configured time, an EventBridge rule invokes a Lambda that calls `DeleteStack`, tearing down all resources in the environment.