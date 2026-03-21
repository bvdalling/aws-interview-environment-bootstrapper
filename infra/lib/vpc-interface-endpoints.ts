import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Interface endpoints so private instances reach SSM, CloudWatch Logs, and STS
 * without relying on the NAT path for those AWS APIs (private DNS enabled).
 */
export function addVpcInterfaceEndpoints(scope: Construct, vpc: ec2.Vpc): void {
  const endpointSg = new ec2.SecurityGroup(scope, 'VpcInterfaceEndpointSg', {
    vpc,
    description: 'HTTPS to VPC interface endpoints',
    allowAllOutbound: true,
  });
  endpointSg.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(443),
    'HTTPS from VPC',
  );

  const subnets = { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS };
  const sg = [endpointSg];

  vpc.addInterfaceEndpoint('SsmEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.SSM,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
  vpc.addInterfaceEndpoint('SsmMessagesEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
  vpc.addInterfaceEndpoint('Ec2MessagesEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
  vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
  vpc.addInterfaceEndpoint('StsEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.STS,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
  vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    subnets,
    securityGroups: sg,
    privateDnsEnabled: true,
  });
}
