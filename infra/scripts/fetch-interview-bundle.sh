set -euxo pipefail

mkdir -p /home/ubuntu/interview

aws s3 cp "s3://__PROJECT_BUCKET__/__PROJECT_ZIP_KEY__" /home/ubuntu/interview.zip
unzip -o /home/ubuntu/interview.zip -d /home/ubuntu/interview
chown -R ubuntu:ubuntu /home/ubuntu/interview /home/ubuntu/interview.zip

bash -lc 'cat > /home/ubuntu/versions.txt <<EOF
Node: $(node --version)
NPM: $(npm --version)
Docker: $(docker --version)
AWS CLI: $(aws --version 2>&1)
EOF'

chown ubuntu:ubuntu /home/ubuntu/versions.txt

