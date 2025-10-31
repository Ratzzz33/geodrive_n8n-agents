#!/bin/bash
# Однострочная установка - скопируйте и выполните на сервере
# curl -fsSL https://raw.githubusercontent.com/Ratzzz33/geodrive_n8n-agents/master/setup/complete-installation.sh | bash

# Или локально:
export DEBIAN_FRONTEND=noninteractive && \
apt-get update -y && \
apt-get install -y git curl wget nano ufw ca-certificates gnupg lsb-release && \
mkdir -p /etc/apt/keyrings && \
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
apt-get update && \
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && \
systemctl start docker && \
systemctl enable docker && \
cd /root && \
git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git 2>/dev/null || (cd geodrive_n8n-agents && git pull) && \
cd geodrive_n8n-agents && \
if [ ! -f .env ]; then cp env.example .env; fi && \
chmod +x setup/04-setup-mcp-server.sh && \
bash setup/04-setup-mcp-server.sh && \
ufw allow 22/tcp && ufw allow 5678/tcp && ufw allow 1880/tcp && ufw --force enable && \
echo "Установка завершена! Отредактируйте .env и запустите: docker compose up -d"

