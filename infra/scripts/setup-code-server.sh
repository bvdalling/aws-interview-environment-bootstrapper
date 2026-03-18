set -euxo pipefail

curl -fsSL https://code-server.dev/install.sh | sh

CODE_SERVER_BIN="$(command -v code-server)"
test -x "$CODE_SERVER_BIN"

BASE_PATH='__CODE_SERVER_BASE_PATH__'

mkdir -p /home/ubuntu/.config/code-server

# code-server 4.111+: no base-path in config — nginx strips /env-.../ to /.
cat > /home/ubuntu/.config/code-server/config.yaml <<EOF
bind-addr: 127.0.0.1:8080
auth: password
password: __CODE_SERVER_PASSWORD__
cert: false
EOF

chown -R ubuntu:ubuntu /home/ubuntu/.config

cat > /etc/code-server-proxy.env <<EOF
VSCODE_PROXY_URI=https://__CLOUDFRONT_HOST__${BASE_PATH}/proxy/{{port}}
EOF
chmod 644 /etc/code-server-proxy.env

cat > /etc/systemd/system/code-server.service <<UNIT
[Unit]
Description=code-server (VS Code in browser)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=120
StartLimitBurst=5

[Service]
Type=simple
User=ubuntu
Group=ubuntu
Environment=HOME=/home/ubuntu
EnvironmentFile=/etc/code-server-proxy.env
WorkingDirectory=/home/ubuntu
ExecStart=${CODE_SERVER_BIN}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable code-server
systemctl restart code-server

for i in $(seq 1 80); do
  code="$(curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' "http://127.0.0.1:8080/" 2>/dev/null || echo 000)"
  if echo "$code" | grep -qE '^(200|302|401)$'; then
    echo "code-server ready (HTTP $code)"
    break
  fi
  if [ "$i" -eq 80 ]; then
    echo "code-server failed to become ready"
    systemctl status code-server --no-pager || true
    journalctl -u code-server -n 120 --no-pager || true
    exit 1
  fi
  sleep 3
done

systemctl is-active code-server
