import * as path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export type ProjectBucket = {
  bucket: s3.Bucket;
  uploadDeployment: s3deploy.BucketDeployment;
};

export function createProjectBucket(scope: Construct): ProjectBucket {
  const projectBucket = new s3.Bucket(scope, 'ProjectFilesBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    versioned: true,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });

  const interviewZipSource = s3deploy.Source.asset(
    path.join(__dirname, '../../interview'),
  );

  const uploadDeployment = new s3deploy.BucketDeployment(
    scope,
    'UploadInterviewZip',
    {
      destinationBucket: projectBucket,
      destinationKeyPrefix: 'bundles/interview',
      sources: [interviewZipSource],
      extract: false,
    },
  );

  return { bucket: projectBucket, uploadDeployment };
}

