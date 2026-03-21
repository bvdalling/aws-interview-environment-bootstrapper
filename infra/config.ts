export type InterviewFleetConfig = {
  name: string;
  count: number;
  instanceType: string;
  volumeSizeGiB: number;
  codeServerPassword: string;
  projectZipKey: string;
  /**
   * Open VSX extension ids (e.g. ms-python.python). Microsoft Marketplace-only
   * extensions may be unavailable in code-server.
   */
  codeServerExtensions: string[];
  /** Absolute path on the instance for code-server to open (must match bundle extract dir). */
  codeServerWorkspaceFolder: string;
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
      projectZipKey: 'bundles/interview/interview.zip',
      codeServerExtensions: ['vue.volar', 'dbaeumer.vscode-eslint'],
      codeServerWorkspaceFolder: '/home/ubuntu/interview',
    },
  ],
  terminationDateUtc: '2026-03-18T23:59:00Z',
};

