export type InterviewFleetConfig = {
  name: string;
  count: number;
  instanceType: string;
  volumeSizeGiB: number;
  codeServerPassword: string;
  projectZipKey: string;
};

export type AppConfig = {
  vpc: {
    maxAzs: number;
    natGateways: number;
    publicSubnetCidrMask: number;
  };
  amiParameterPath: string;
  fleets: InterviewFleetConfig[];
  /**
   * ISO 8601 UTC datetime string, e.g. 2026-03-31T23:59:00Z.
   * The infra stack will schedule a teardown at/after this timestamp.
   */
  terminationDateUtc: string;
};

export const appConfig: AppConfig = {
  vpc: {
    maxAzs: 2,
    natGateways: 1,
    publicSubnetCidrMask: 24,
  },
  amiParameterPath:
    '/aws/service/canonical/ubuntu/server/noble/stable/current/amd64/hvm/ebs-gp3/ami-id',
  fleets: [
    {
      name: 'interview',
      count: 2,
      instanceType: 't3.small',
      volumeSizeGiB: 30,
      codeServerPassword: 'ReplaceMeNow-StrongPassword1!',
      projectZipKey: 'bundles/interview/79abb4feab686daf06fcff46e168cbc75a6fd597566d5b65384abfc204e10445.zip',
    },
  ],
  terminationDateUtc: '2026-03-18T23:59:00Z',
};

