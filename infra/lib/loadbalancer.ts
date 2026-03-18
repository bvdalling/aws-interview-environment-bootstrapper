import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export type SharedAlbResult = {
  alb: elbv2.ApplicationLoadBalancer;
  listener: elbv2.ApplicationListener;
  distribution: cloudfront.Distribution;
};

export type SharedAlbProps = {
  scope: Construct;
  vpc: ec2.IVpc;
  cloudFrontPrefixList: ec2.IPrefixList;
  cloudFrontLogsBucket: s3.Bucket;
  cloudFrontLogsBasePrefix: string;
  webAclArn?: string;
};

export function createSharedAlbAndDistribution(props: SharedAlbProps): SharedAlbResult {
  const scope = props.scope;
  const vpc = props.vpc;
  const cloudFrontPrefixList = props.cloudFrontPrefixList;
  const cloudFrontLogsBucket = props.cloudFrontLogsBucket;
  const cloudFrontLogsBasePrefix = props.cloudFrontLogsBasePrefix;
  const webAclArn = props.webAclArn;
  const albSecurityGroup = new ec2.SecurityGroup(scope, 'SharedAlbSg', {
    vpc,
    allowAllOutbound: false,
    description: 'Shared ALB security group for interview environments',
  });

  albSecurityGroup.addIngressRule(
    ec2.Peer.prefixList(cloudFrontPrefixList.prefixListId),
    ec2.Port.tcp(80),
    'Allow HTTP only from CloudFront origin-facing servers',
  );

  albSecurityGroup.addEgressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(80),
    'Allow HTTP health checks and traffic to targets within the VPC',
  );

  const alb = new elbv2.ApplicationLoadBalancer(scope, 'SharedAlb', {
    vpc,
    internetFacing: true,
    securityGroup: albSecurityGroup,
    vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
  });

  const listener = alb.addListener('SharedAlbHttpListener', {
    port: 80,
    protocol: elbv2.ApplicationProtocol.HTTP,
    defaultAction: elbv2.ListenerAction.fixedResponse(404, {
      contentType: 'text/plain',
      messageBody: 'Not Found',
    }),
  });

  if (webAclArn) {
    new wafv2.CfnWebACLAssociation(scope, 'SharedAlbWafAssociation', {
      resourceArn: alb.loadBalancerArn,
      webAclArn,
    });
  }

  const distribution = new cloudfront.Distribution(scope, 'SharedDistribution', {
    comment: 'Shared interview environments distribution',
    defaultBehavior: {
      origin: new origins.HttpOrigin(alb.loadBalancerDnsName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        readTimeout: Duration.seconds(60),
        keepaliveTimeout: Duration.seconds(60),
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      // Forward viewer Host so code-server generates correct absolute URLs for WS/API (not ALB hostname).
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      compress: false,
    },
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    enableLogging: true,
    logBucket: cloudFrontLogsBucket,
    logFilePrefix: `${cloudFrontLogsBasePrefix}/shared/`,
    httpVersion: cloudfront.HttpVersion.HTTP2,
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2025,
  });

  return { alb, listener, distribution };
}

