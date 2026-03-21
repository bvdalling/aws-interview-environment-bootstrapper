set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

# Best-effort: regional mirrors can be inconsistent during sync. Never abort
# user-data because update failed; install uses whatever index is available.
apt-get -o Acquire::Retries=5 update -y || true

apt-get install -y curl wget unzip nginx docker.io ca-certificates gnupg lsb-release python3 python3-pip

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install

curl -fsSL https://deb.nodesource.com/setup_current.x | bash -
apt-get install -y nodejs
