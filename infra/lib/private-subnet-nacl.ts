import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * Associates a dedicated NACL with all private (with egress) subnets so EC2
 * instances cannot reach each other's subnets at the network layer, while
 * preserving ALB → target traffic, NAT egress, and VPC DNS.
 *
 * Security groups already restrict instance ingress to the ALB; this is
 * defense in depth at the subnet boundary (stateless rules).
 */
export function attachIsolatedPrivateSubnetNetworkAcl(
  scope: Construct,
  vpc: ec2.Vpc,
): void {
  const nacl = new ec2.CfnNetworkAcl(scope, 'PrivateAppIsolationNacl', {
    vpcId: vpc.vpcId,
  });

  const privateSubnets = vpc.privateSubnets;
  const publicSubnets = vpc.publicSubnets;

  let ingressRule = 50;

  for (let i = 0; i < privateSubnets.length; i++) {
    new ec2.CfnNetworkAclEntry(scope, `PrivateNaclIngressDenyPrivate${i}`, {
      networkAclId: nacl.ref,
      ruleNumber: ingressRule,
      protocol: -1,
      ruleAction: 'deny',
      egress: false,
      cidrBlock: privateSubnets[i].ipv4CidrBlock,
    });
    ingressRule += 1;
  }

  for (let i = 0; i < publicSubnets.length; i++) {
    new ec2.CfnNetworkAclEntry(scope, `PrivateNaclIngressAlbHttp${i}`, {
      networkAclId: nacl.ref,
      ruleNumber: ingressRule,
      protocol: 6,
      ruleAction: 'allow',
      egress: false,
      cidrBlock: publicSubnets[i].ipv4CidrBlock,
      portRange: { from: 80, to: 80 },
    });
    ingressRule += 1;
  }

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclIngressDnsUdp', {
    networkAclId: nacl.ref,
    ruleNumber: ingressRule,
    protocol: 17,
    ruleAction: 'allow',
    egress: false,
    cidrBlock: vpc.vpcCidrBlock,
    portRange: { from: 53, to: 53 },
  });
  ingressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclIngressDnsTcp', {
    networkAclId: nacl.ref,
    ruleNumber: ingressRule,
    protocol: 6,
    ruleAction: 'allow',
    egress: false,
    cidrBlock: vpc.vpcCidrBlock,
    portRange: { from: 53, to: 53 },
  });
  ingressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclIngressTcpReturn', {
    networkAclId: nacl.ref,
    ruleNumber: ingressRule,
    protocol: 6,
    ruleAction: 'allow',
    egress: false,
    cidrBlock: '0.0.0.0/0',
    portRange: { from: 1024, to: 65535 },
  });
  ingressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclIngressUdpReturn', {
    networkAclId: nacl.ref,
    ruleNumber: ingressRule,
    protocol: 17,
    ruleAction: 'allow',
    egress: false,
    cidrBlock: '0.0.0.0/0',
    portRange: { from: 1024, to: 65535 },
  });

  let egressRule = 50;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclEgressDnsUdp', {
    networkAclId: nacl.ref,
    ruleNumber: egressRule,
    protocol: 17,
    ruleAction: 'allow',
    egress: true,
    cidrBlock: vpc.vpcCidrBlock,
    portRange: { from: 53, to: 53 },
  });
  egressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclEgressDnsTcp', {
    networkAclId: nacl.ref,
    ruleNumber: egressRule,
    protocol: 6,
    ruleAction: 'allow',
    egress: true,
    cidrBlock: vpc.vpcCidrBlock,
    portRange: { from: 53, to: 53 },
  });
  egressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclEgressHttp', {
    networkAclId: nacl.ref,
    ruleNumber: egressRule,
    protocol: 6,
    ruleAction: 'allow',
    egress: true,
    cidrBlock: '0.0.0.0/0',
    portRange: { from: 80, to: 80 },
  });
  egressRule += 1;

  new ec2.CfnNetworkAclEntry(scope, 'PrivateNaclEgressHttps', {
    networkAclId: nacl.ref,
    ruleNumber: egressRule,
    protocol: 6,
    ruleAction: 'allow',
    egress: true,
    cidrBlock: '0.0.0.0/0',
    portRange: { from: 443, to: 443 },
  });
  egressRule += 1;

  for (let i = 0; i < publicSubnets.length; i++) {
    new ec2.CfnNetworkAclEntry(scope, `PrivateNaclEgressToAlbEphemeral${i}`, {
      networkAclId: nacl.ref,
      ruleNumber: egressRule,
      protocol: 6,
      ruleAction: 'allow',
      egress: true,
      cidrBlock: publicSubnets[i].ipv4CidrBlock,
      portRange: { from: 1024, to: 65535 },
    });
    egressRule += 1;
  }

  for (let i = 0; i < privateSubnets.length; i++) {
    new ec2.CfnNetworkAclEntry(scope, `PrivateNaclEgressDenyPrivate${i}`, {
      networkAclId: nacl.ref,
      ruleNumber: egressRule,
      protocol: -1,
      ruleAction: 'deny',
      egress: true,
      cidrBlock: privateSubnets[i].ipv4CidrBlock,
    });
    egressRule += 1;
  }

  for (let i = 0; i < privateSubnets.length; i++) {
    new ec2.CfnSubnetNetworkAclAssociation(scope, `PrivateNaclAssoc${i}`, {
      networkAclId: nacl.ref,
      subnetId: privateSubnets[i].subnetId,
    });
  }
}
