set -euxo pipefail

mkdir -p /home/ubuntu/interview

rm -f /home/ubuntu/interview.zip

# Retry download in case the instance hits transient network/VPC-endpoint issues.
for attempt in 1 2 3; do
  echo "Downloading interview bundle (attempt ${attempt}/3)..."
  if aws s3 cp "s3://__PROJECT_BUCKET__/__PROJECT_ZIP_KEY__" /home/ubuntu/interview.zip; then
    break
  fi
  if [ "${attempt}" -eq 3 ]; then
    echo "Failed to download interview bundle after 3 attempts."
    exit 1
  fi
  sleep 2
done

echo "Bundle zip stats:"
ls -lah /home/ubuntu/interview.zip
df -h /home/ubuntu

# Verify zip integrity before extracting so we get a clear failure reason.
unzip -t /home/ubuntu/interview.zip

# Extract (overwrite existing files).
unzip -o /home/ubuntu/interview.zip -d /home/ubuntu/interview

chown -R ubuntu:ubuntu /home/ubuntu/interview /home/ubuntu/interview.zip

bash -lc 'cat > /home/ubuntu/versions.txt <<EOF
Node: $(node --version)
NPM: $(npm --version)
Docker: $(docker --version)
AWS CLI: $(aws --version 2>&1)
EOF'

chown ubuntu:ubuntu /home/ubuntu/versions.txt

