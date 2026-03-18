set -euxo pipefail

mkdir -p /tmp/cw-agent
cd /tmp/cw-agent

wget -q "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb" -O amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'EOF'
{
  "agent": {
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/cloud-init.log",
            "log_group_name": "__LOG_GROUP_NAME__",
            "log_stream_name": "{instance_id}/cloud-init.log",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          },
          {
            "file_path": "/var/log/cloud-init-output.log",
            "log_group_name": "__LOG_GROUP_NAME__",
            "log_stream_name": "{instance_id}/cloud-init-output.log",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "__LOG_GROUP_NAME__",
            "log_stream_name": "{instance_id}/user-data.log"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "__LOG_GROUP_NAME__",
            "log_stream_name": "{instance_id}/nginx-error.log"
          }
        ]
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

systemctl enable amazon-cloudwatch-agent

