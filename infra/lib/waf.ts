import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export type InterviewWaf = {
  webAclArn: string;
};

export function createInterviewWebAcl(scope: Construct): InterviewWaf {
  const webAcl = new wafv2.CfnWebACL(scope, 'InterviewWebAcl', {
    scope: 'REGIONAL',
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: 'InterviewWebAcl',
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        name: 'AWSManagedRulesCommonRuleSet',
        priority: 10,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesCommonRuleSet',
          sampledRequestsEnabled: true,
        },
      },
      {
        name: 'RateLimitPerIp',
        priority: 20,
        statement: {
          rateBasedStatement: {
            limit: 1000,
            aggregateKeyType: 'IP',
          },
        },
        action: { block: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'RateLimitPerIp',
          sampledRequestsEnabled: true,
        },
      },
    ],
  });

  return { webAclArn: webAcl.attrArn };
}

