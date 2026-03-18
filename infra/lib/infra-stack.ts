import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { appConfig } from '../config';
import { createProjectBucket } from './project-bucket';
import { createCloudFrontLogsBucket } from './cloudfront-logs-bucket';
import { loadTemplates } from './templates';
import { createStackTermination } from './termination';
import { InterviewEnvironment } from './interview-environment';
import { parseTerminationDateUtc } from './time';
import { createInterviewWebAcl } from './waf';
import { createSharedAlbAndDistribution } from './loadbalancer';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const instanceRecreateToken = process.env.INSTANCE_RECREATE_TOKEN ?? '0';

    const terminationDateUtc = parseTerminationDateUtc(
      appConfig.terminationDateUtc,
    );

    const now = Date.now();
    const maxHorizonMs = 365 * 24 * 60 * 60 * 1000;
    if (terminationDateUtc.getTime() - now > maxHorizonMs) {
      throw new Error(
        `appConfig.terminationDateUtc is too far in the future (${appConfig.terminationDateUtc}). Refusing to create an environment with >365 day lifetime.`,
      );
    }

    cdk.Tags.of(this).add('Purpose', 'InterviewEnvironment');
    cdk.Tags.of(this).add('AutoTeardown', 'true');
    cdk.Tags.of(this).add('TerminationDateUtc', appConfig.terminationDateUtc);

    const vpc = new ec2.Vpc(this, 'InterviewVpc', {
      maxAzs: appConfig.vpc.maxAzs,
      natGateways: appConfig.vpc.natGateways,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: appConfig.vpc.publicSubnetCidrMask,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: appConfig.vpc.publicSubnetCidrMask,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });

    const projectBucketResult = createProjectBucket(this);
    const cloudFrontLogsBucketResult = createCloudFrontLogsBucket(this);
    const webAclResult = createInterviewWebAcl(this);

    const machineImage = ec2.MachineImage.fromSsmParameter(
      appConfig.amiParameterPath,
      {
        os: ec2.OperatingSystemType.LINUX,
      },
    );

    const cloudFrontPrefixList = ec2.PrefixList.fromLookup(
      this,
      'CloudFrontOriginFacingPrefixList',
      {
        prefixListName: 'com.amazonaws.global.cloudfront.origin-facing',
      },
    );

    const templates = loadTemplates();

    let effectiveTerminationDate: Date;
    if (terminationDateUtc.getTime() > now) {
      effectiveTerminationDate = terminationDateUtc;
    } else {
      effectiveTerminationDate = new Date(now + 5 * 60 * 1000);
    }

    createStackTermination(this, {
      stack: this,
      terminationDateUtcString: appConfig.terminationDateUtc,
      effectiveTerminationDate,
    });

    const loadBalancer = createSharedAlbAndDistribution({
      scope: this,
      vpc,
      cloudFrontPrefixList,
      cloudFrontLogsBucket: cloudFrontLogsBucketResult.bucket,
      cloudFrontLogsBasePrefix: cloudFrontLogsBucketResult.basePrefix,
      webAclArn: webAclResult.webAclArn,
    });
    const alb = loadBalancer.alb;
    const albListener = loadBalancer.listener;
    const distribution = loadBalancer.distribution;

    let envOrdinal = 0;
    const usedListenerRulePriorities = new Set<number>();
    const pickListenerRulePriority = (routeGuid: string): number => {
      // ALB listener rule priorities must be unique per listener.
      // We intentionally derive it from the GUID so that replacements during
      // updates don't conflict with old rules that still exist.
      let attempt = 0;
      while (true) {
        const hash = crypto
          .createHash('sha256')
          .update(`${routeGuid}-${envOrdinal}-${attempt}`)
          .digest();
        const candidate = 1 + (hash.readUInt32BE(0) % 50_000); // 1-50000 inclusive
        if (!usedListenerRulePriorities.has(candidate)) {
          usedListenerRulePriorities.add(candidate);
          return candidate;
        }
        attempt += 1;
      }
    };
    for (const fleet of appConfig.fleets) {
      for (let i = 0; i < fleet.count; i++) {
        const routeGuid = crypto.randomUUID();
        const listenerRulePriority = pickListenerRulePriority(routeGuid);
        envOrdinal += 1;

        new InterviewEnvironment(this, `InterviewEnvironment-${fleet.name}-${i + 1}`, {
          stackScope: this,
          vpc,
          projectBucket: projectBucketResult.bucket,
          cloudFrontLogsBucket: cloudFrontLogsBucketResult.bucket,
          cloudFrontLogsBasePrefix: cloudFrontLogsBucketResult.basePrefix,
          webAclArn: webAclResult.webAclArn,
          cloudFrontPrefixList,
          machineImage,
          fleet,
          index: i,
          instanceRecreateToken,
          templates,
          alb,
          albListener,
          cloudFrontDistributionDomain: distribution.distributionDomainName,
          routeGuid,
          listenerRulePriority,
        });
      }
    }

    new CfnOutput(this, 'ProjectBucketName', {
      value: projectBucketResult.bucket.bucketName,
    });

    new CfnOutput(this, 'SharedCloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
