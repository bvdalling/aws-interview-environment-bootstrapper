import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { InterviewFleetConfig } from '../config';
import {
  renderCodeServerScript,
  renderFetchBundleScript,
  renderNginxConfig,
  renderSetupCloudWatchAgentScript,
  type Templates,
} from './templates';

export type InterviewEnvironmentProps = {
  stackScope: Construct;
  vpc: ec2.IVpc;
  projectBucket: s3.Bucket;
  cloudFrontLogsBucket: s3.Bucket;
  cloudFrontLogsBasePrefix: string;
  cloudFrontPrefixList: ec2.IPrefixList;
  alb: elbv2.IApplicationLoadBalancer;
  albSecurityGroupId: string;
  albListener: elbv2.IApplicationListener;
  /** CloudFront domain only, e.g. d111abcdef.cloudfront.net (for code-server public URLs). */
  cloudFrontDistributionDomain: string;
  cloudFrontDistribution: cloudfront.Distribution;
  routeGuid: string;
  listenerRulePriority: number;
  machineImage: ec2.IMachineImage;
  fleet: InterviewFleetConfig;
  index: number;
  instanceRecreateToken: string;
  templates: Templates;
};

export class InterviewEnvironment extends Construct {
  readonly instance: ec2.Instance;
  readonly pathPattern: string;
  readonly targetGroup: elbv2.IApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: InterviewEnvironmentProps) {
    super(scope, id);

    const codeServerHeredoc = 'INTERVIEW_CODE_SERVER_EOF';
    const nginxHeredoc = 'INTERVIEW_NGINX_EOF';

    const suffix = `${props.fleet.name}-${props.index + 1}`;
    const generatedSuffix = `${suffix}-${props.instanceRecreateToken}`;

    const logGroupName = `/interview/${generatedSuffix}`;
    const instanceLogGroup = new logs.LogGroup(
      props.stackScope,
      `InstanceLogs-${generatedSuffix}`,
      {
        logGroupName,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    const role = new iam.Role(props.stackScope, `Role-${generatedSuffix}`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [props.projectBucket.arnForObjects(props.fleet.projectZipKey)],
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [props.projectBucket.bucketArn],
        conditions: {
          StringLike: {
            's3:prefix': [props.fleet.projectZipKey],
          },
        },
      }),
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
        ],
        resources: [instanceLogGroup.logGroupArn, `${instanceLogGroup.logGroupArn}:*`],
      }),
    );

    const codeServerSecret = new secretsmanager.Secret(
      props.stackScope,
      `CodeServerSecret-${generatedSuffix}`,
      {
        description: `Sandcastle code-server password for ${suffix}`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.fleet.codeServerPassword),
      },
    );
    codeServerSecret.grantRead(role);

    const instanceSg = new ec2.SecurityGroup(props.stackScope, `Sg-${generatedSuffix}`, {
      vpc: props.vpc,
      allowAllOutbound: false,
      description: `Sandcastle EC2 security group for ${suffix}`,
    });

    instanceSg.addIngressRule(
      ec2.Peer.securityGroupId(props.albSecurityGroupId),
      ec2.Port.tcp(80),
      'Allow HTTP only from the ALB',
    );

    // With `allowAllOutbound: false`, EC2 instances still require DNS egress
    // to resolve external endpoints (apt repos, S3, CloudWatch, etc.).
    // The VPC resolver lives inside the VPC CIDR, so allow DNS to it only.
    instanceSg.addEgressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.udp(53),
      'DNS UDP outbound to VPC resolver',
    );
    instanceSg.addEgressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(53),
      'DNS TCP outbound to VPC resolver',
    );

    instanceSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP outbound (apt)');
    instanceSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS outbound');

    const codeServerBasePath = `/env-${props.routeGuid}`;

    // This value is injected into CloudFront as a custom origin header, and
    // validated by NGINX before proxying to code-server.
    const originVerifyExpected = crypto.randomBytes(32).toString('hex');

    const fetchBundleScript = renderFetchBundleScript(props.templates, {
      projectBucketName: props.projectBucket.bucketName,
      projectZipKey: props.fleet.projectZipKey,
      workspaceFolder: props.fleet.codeServerWorkspaceFolder,
    });

    const codeServerScript = renderCodeServerScript(props.templates, {
      codeServerBasePath,
      cloudFrontHost: props.cloudFrontDistributionDomain,
      workspaceFolder: props.fleet.codeServerWorkspaceFolder,
      extensions: props.fleet.codeServerExtensions,
    });

    const nginxConfig = renderNginxConfig(props.templates, {
      basePath: codeServerBasePath,
      originVerifyExpected,
    });

    const setupCloudWatchAgentScript = renderSetupCloudWatchAgentScript(
      props.templates,
      {
        logGroupName,
      },
    );

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // Capture all UserData output to a file and the EC2 instance console.
      'exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1',
      'echo "user-data: start $(date -Is)"',
      props.templates.bootstrapBase,
      setupCloudWatchAgentScript,
      'export USER=ubuntu',
      'export HOME=/home/ubuntu',
      'export SHELL=/bin/bash',
      'mkdir -p "$HOME"',
      'cd "$HOME"',
      fetchBundleScript,
      `export CODE_SERVER_PASSWORD="$(aws secretsmanager get-secret-value --region ${cdk.Stack.of(props.stackScope).region} --secret-id ${codeServerSecret.secretArn} --query SecretString --output text)"`,
      `cat > /tmp/interview-setup-code-server.sh <<'${codeServerHeredoc}'`,
      codeServerScript,
      codeServerHeredoc,
      'chmod +x /tmp/interview-setup-code-server.sh',
      'bash /tmp/interview-setup-code-server.sh',
      `cat > /etc/nginx/sites-available/code-server <<'${nginxHeredoc}'`,
      nginxConfig,
      nginxHeredoc,
      'rm -f /etc/nginx/sites-enabled/default',
      'rm -f /etc/nginx/sites-available/default',
      'ln -sf /etc/nginx/sites-available/code-server /etc/nginx/sites-enabled/code-server',
      'nginx -t',
      'systemctl enable nginx',
      'systemctl restart nginx',
      'mkdir -p /var/local/interview',
      'echo "user-data: ok $(date -Is)" | tee /var/local/interview/userdata-ok',
    );

    const instance = new ec2.Instance(props.stackScope, `Instance-${generatedSuffix}`, {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroup: instanceSg,
      role,
      machineImage: props.machineImage,
      instanceType: new ec2.InstanceType(props.fleet.instanceType),
      userData,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(props.fleet.volumeSizeGiB, {
            encrypted: true,
            deleteOnTermination: true,
          }),
        },
      ],
    });

    cdk.Tags.of(instance).add('Name', suffix);
    cdk.Tags.of(instance).add('Purpose', 'Sandcastle');
    cdk.Tags.of(instance).add('Fleet', props.fleet.name);

    props.projectBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: `AllowReadFor${generatedSuffix}`,
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(role.roleArn)],
        actions: ['s3:GetObject'],
        resources: [props.projectBucket.arnForObjects(props.fleet.projectZipKey)],
      }),
    );

    props.projectBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: `AllowListFor${generatedSuffix}`,
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(role.roleArn)],
        actions: ['s3:ListBucket'],
        resources: [props.projectBucket.bucketArn],
        conditions: {
          StringLike: {
            's3:prefix': [props.fleet.projectZipKey],
          },
        },
      }),
    );

    const targetGroup = new elbv2.ApplicationTargetGroup(
      props.stackScope,
      `AlbTargets-${generatedSuffix}`,
      {
        vpc: props.vpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [new elbv2Targets.InstanceTarget(instance)],
        healthCheck: {
          path: '/health',
          protocol: elbv2.Protocol.HTTP,
          healthyHttpCodes: '200',
        },
      },
    );

    const pathPattern = `/env-${props.routeGuid}/*`;

    // Ensure only CloudFront-originated requests include the correct secret
    // header for this environment's origin path.
    props.cloudFrontDistribution.addBehavior(
      pathPattern,
      new origins.HttpOrigin(props.alb.loadBalancerDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        readTimeout: Duration.seconds(60),
        keepaliveTimeout: Duration.seconds(60),
        customHeaders: {
          'X-Origin-Verify': originVerifyExpected,
        },
      }),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Forward viewer Host for code-server to generate correct absolute URLs.
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        compress: false,
      },
    );

    props.albListener.addAction(`AlbListenerRule-${generatedSuffix}`, {
      priority: props.listenerRulePriority,
      conditions: [elbv2.ListenerCondition.pathPatterns([pathPattern])],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    new CfnOutput(props.stackScope, `InstanceId-${generatedSuffix}`, {
      value: instance.instanceId,
    });

    new CfnOutput(props.stackScope, `EnvironmentUrl-${generatedSuffix}`, {
      value: `https://${props.cloudFrontDistributionDomain}${codeServerBasePath}/`,
    });

    this.instance = instance;
    this.pathPattern = pathPattern;
    this.targetGroup = targetGroup;
  }
}

