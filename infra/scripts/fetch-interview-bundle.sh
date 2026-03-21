set -euxo pipefail

mkdir -p __WORKSPACE_FOLDER__

rm -f __WORKSPACE_ZIP_PATH__

# Retry download in case the instance hits transient network/VPC-endpoint issues.
for attempt in 1 2 3; do
  echo "Downloading workspace bundle (attempt ${attempt}/3)..."
  if aws s3 cp "s3://__PROJECT_BUCKET__/__PROJECT_ZIP_KEY__" __WORKSPACE_ZIP_PATH__; then
    break
  fi
  if [ "${attempt}" -eq 3 ]; then
    echo "Failed to download workspace bundle after 3 attempts."
    exit 1
  fi
  sleep 2
done

echo "Bundle zip stats:"
ls -lah __WORKSPACE_ZIP_PATH__
df -h /home/ubuntu

# Verify zip integrity before extracting so we get a clear failure reason.
unzip -t __WORKSPACE_ZIP_PATH__

# Extract (overwrite existing files).
unzip -o __WORKSPACE_ZIP_PATH__ -d __WORKSPACE_FOLDER__

chown -R ubuntu:ubuntu __WORKSPACE_FOLDER__ __WORKSPACE_ZIP_PATH__

bash -lc 'cat > /home/ubuntu/versions.txt <<EOF
Node: $(node --version)
NPM: $(npm --version)
Docker: $(docker --version)
AWS CLI: $(aws --version 2>&1)
EOF'

chown ubuntu:ubuntu /home/ubuntu/versions.txt

