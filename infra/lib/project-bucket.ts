import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';

export type ProjectBucket = {
  bucket: s3.Bucket;
  uploadDeployment: s3deploy.BucketDeployment;
};

export function createProjectBucket(scope: Construct): ProjectBucket {
  const projectBucket = new s3.Bucket(scope, 'ProjectFilesBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });

  const interviewZipSource = s3deploy.Source.asset(
    path.join(__dirname, '../../interview'),
  );

  const interviewZipKey = 'bundles/interview/interview.zip';

  const uploadDeployment = new s3deploy.BucketDeployment(
    scope,
    'UploadInterviewZip',
    {
      destinationBucket: projectBucket,
      destinationKeyPrefix: 'bundles/interview',
      sources: [interviewZipSource],
      extract: false,
      // Prevent the subsequent rename step (into `interview.zip`) from
      // being pruned away on future deployments.
      exclude: ['interview.zip'],
    },
  );

  // `s3deploy.Source.asset(directory, ...)` packages the directory into a zip
  // with a CDK-generated filename (e.g. `asset.<hash>.zip`). When we set
  // `extract: false`, that archive filename is what ends up in the bucket.
  //
  // The rest of this project expects a stable key, so copy/rename it here.
  // Note: `objectKeys` may be represented as a CloudFormation list token, so
  // we must use `Fn.select` rather than direct indexing.
  // `BucketDeployment.objectKeys` corresponds to the source object's key name
  // in CDK's staging bucket. Because we deploy with
  // `destinationKeyPrefix: 'bundles/interview'`, we need to prepend that
  // prefix to construct the actual destination object key we want to copy.
  const uploadedInterviewZipKey = cdk.Fn.join('/', [
    'bundles/interview',
    cdk.Fn.select(0, uploadDeployment.objectKeys),
  ]);
  const renameInterviewZip = new cr.AwsCustomResource(
    scope,
    'RenameInterviewZipToFixedName',
    {
      onCreate: {
        service: 'S3',
        action: 'copyObject',
        parameters: {
          Bucket: projectBucket.bucketName,
          CopySource: cdk.Fn.join('/', [projectBucket.bucketName, uploadedInterviewZipKey]),
          Key: interviewZipKey,
          MetadataDirective: 'COPY',
        },
        physicalResourceId: cr.PhysicalResourceId.of(interviewZipKey),
      },
      onUpdate: {
        service: 'S3',
        action: 'copyObject',
        parameters: {
          Bucket: projectBucket.bucketName,
          CopySource: cdk.Fn.join('/', [projectBucket.bucketName, uploadedInterviewZipKey]),
          Key: interviewZipKey,
          MetadataDirective: 'COPY',
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          // S3 CopyObject requires PutObject permissions on the destination.
          actions: ['s3:CopyObject', 's3:PutObject'],
          resources: [projectBucket.arnForObjects(interviewZipKey)],
        }),
        new iam.PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [projectBucket.bucketArn],
          // AwsCustomResource's underlying AWS SDK call path for `copyObject`
          // can require `ListBucket` with/without an `s3:prefix` context value
          // (condition keys are not always present the way we expect), so we
          // allow bucket listing to avoid deployment failures.
        }),
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [projectBucket.arnForObjects('bundles/interview/*')],
        }),
      ]),
    },
  );

  renameInterviewZip.node.addDependency(uploadDeployment);

  return { bucket: projectBucket, uploadDeployment };
}

