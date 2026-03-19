import { Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { toEventBridgeCronPropsUtc } from './time';

export type StackTermination = {
  fn: lambda.Function;
  rule: events.Rule;
};

export function createStackTermination(
  scope: Construct,
  props: {
    stack: Stack;
    terminationDateUtcString: string;
    effectiveTerminationDate: Date;
  },
): StackTermination {
  const stackTerminatorFn = new lambda.Function(scope, 'StackTerminatorFn', {
    runtime: lambda.Runtime.NODEJS_LATEST,
    handler: 'index.handler',
    timeout: Duration.seconds(30),
    environment: {
      STACK_NAME: props.stack.stackName,
    },
    code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const cloudformation = new AWS.CloudFormation();

        exports.handler = async () => {
          const stackName = process.env.STACK_NAME;
          if (!stackName) throw new Error('STACK_NAME env var is required');
          await cloudformation.deleteStack({ StackName: stackName }).promise();
          return { ok: true, deleted: stackName };
        };
      `),
  });

  stackTerminatorFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['cloudformation:DeleteStack'],
      resources: [
        Stack.of(scope).formatArn({
          service: 'cloudformation',
          resource: 'stack',
          resourceName: `${props.stack.stackName}/*`,
        }),
      ],
    }),
  );

  const terminationRule = new events.Rule(scope, 'StackTerminationRule', {
    schedule: events.Schedule.cron(
      toEventBridgeCronPropsUtc(props.effectiveTerminationDate),
    ),
  });
  terminationRule.addTarget(new targets.LambdaFunction(stackTerminatorFn));

  return { fn: stackTerminatorFn, rule: terminationRule };
}

