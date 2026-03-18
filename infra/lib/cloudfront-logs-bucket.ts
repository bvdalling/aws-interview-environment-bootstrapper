import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export type CloudFrontLogsBucket = {
  bucket: s3.Bucket;
  basePrefix: string;
};

export function createCloudFrontLogsBucket(scope: Construct): CloudFrontLogsBucket {
  const basePrefix = 'cloudfront-access-logs';

  const bucket = new s3.Bucket(scope, 'CloudFrontAccessLogsBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: false,
    objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    lifecycleRules: [
      {
        enabled: true,
        expiration: Duration.days(30),
      },
    ],
  });

  bucket.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: 'AllowCloudFrontStandardLogDelivery',
      principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [bucket.arnForObjects(`${basePrefix}/*`)],
      conditions: {
        StringEquals: {
          's3:x-amz-acl': 'bucket-owner-full-control',
        },
      },
    }),
  );

  bucket.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: 'AllowCloudFrontStandardLogDeliveryGetBucketAcl',
      principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
      actions: ['s3:GetBucketAcl'],
      resources: [bucket.bucketArn],
    }),
  );

  return { bucket, basePrefix };
}