set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

# Regional Ubuntu mirrors occasionally return inconsistent indexes during sync
# ("File has unexpected size ... Mirror sync in progress?"), which fails apt-get
# update and aborts user-data. Retry with per-connection retries, clear stale
# partial/full lists between attempts, then a final full cache wipe.
apt_update_ok=0
for attempt in $(seq 1 8); do
  if apt-get -o Acquire::Retries=8 -o Acquire::http::Timeout=120 update; then
    apt_update_ok=1
    break
  fi
  echo "apt-get update failed (attempt ${attempt}/8), clearing partial lists and retrying..."
  rm -rf /var/lib/apt/lists/partial/*
  if [ "${attempt}" -lt 8 ]; then
    sleep $((attempt * 15))
  fi
done

if [ "${apt_update_ok}" -ne 1 ]; then
  echo "Clearing full apt lists cache and retrying apt-get update..."
  rm -rf /var/lib/apt/lists/*
  if ! apt-get -o Acquire::Retries=8 -o Acquire::http::Timeout=120 update; then
    echo "apt-get update failed after exhaustive retries."
    exit 1
  fi
fi

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

