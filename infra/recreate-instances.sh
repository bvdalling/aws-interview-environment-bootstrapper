#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-InfraStack}"
TOKEN="${INSTANCE_RECREATE_TOKEN:-}"

if aws cloudformation describe-stacks --stack-name "$STACK_NAME" >/dev/null 2>&1; then
  if [[ -z "$TOKEN" ]]; then
    TOKEN="$(date +%s)"
  fi
fi

INSTANCE_RECREATE_TOKEN="${TOKEN:-0}" npx cdk deploy

