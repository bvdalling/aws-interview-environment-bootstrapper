import * as events from 'aws-cdk-lib/aws-events';

export function parseTerminationDateUtc(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(
      `Invalid appConfig.terminationDateUtc: "${value}". Expected ISO 8601 UTC like "2026-03-31T23:59:00Z".`,
    );
  }
  // Require explicit UTC (Z suffix) to avoid local-time ambiguity.
  if (!value.endsWith('Z')) {
    throw new Error(
      `Invalid appConfig.terminationDateUtc: "${value}". Must be UTC and end with "Z" (e.g. "2026-03-31T23:59:00Z").`,
    );
  }
  return d;
}

export function toEventBridgeCronPropsUtc(d: Date): events.CronOptions {
  // EventBridge Rule schedule expressions support cron()/rate(), not at().
  // Use a one-time cron that includes the year to target a specific UTC timestamp.
  return {
    minute: `${d.getUTCMinutes()}`,
    hour: `${d.getUTCHours()}`,
    day: `${d.getUTCDate()}`,
    month: `${d.getUTCMonth() + 1}`,
    year: `${d.getUTCFullYear()}`,
  };
}

