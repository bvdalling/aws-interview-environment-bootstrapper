import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Sends all VPC flow records to CloudWatch Logs with retention.
 * CDK creates a least-privilege IAM role for the vpc-flow-logs service.
 */
export function createVpcFlowLogs(scope: Construct, vpc: ec2.IVpc): void {
  const logGroup = new logs.LogGroup(scope, 'VpcFlowLogGroup', {
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  new ec2.FlowLog(scope, 'VpcFlowLog', {
    resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
    destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
    trafficType: ec2.FlowLogTrafficType.ALL,
  });
}
