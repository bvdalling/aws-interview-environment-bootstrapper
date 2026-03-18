set -euxo pipefail

curl -fsSL https://code-server.dev/install.sh | sh

mkdir -p /home/ubuntu/.config/code-server

cat > /home/ubuntu/.config/code-server/config.yaml <<EOF
bind-addr: 127.0.0.1:8080
auth: password
password: __CODE_SERVER_PASSWORD__
cert: false
EOF

mkdir -p /home/ubuntu/.config
chown -R ubuntu:ubuntu /home/ubuntu/.config

loginctl enable-linger ubuntu
sudo -u ubuntu XDG_RUNTIME_DIR=/run/user/1000 systemctl --user daemon-reload || true
sudo -u ubuntu XDG_RUNTIME_DIR=/run/user/1000 systemctl --user enable code-server || true
sudo -u ubuntu XDG_RUNTIME_DIR=/run/user/1000 systemctl --user restart code-server || true

