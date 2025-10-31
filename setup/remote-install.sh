#!/bin/bash
# Скрипт для отправки на сервер и выполнения установки

SERVER_IP="46.224.17.15"
SERVER_USER="root"
INSTALL_SCRIPT="setup/complete-installation.sh"

echo "Отправка и выполнение установки на сервере $SERVER_IP..."

# Создаем временный скрипт на сервере
cat > /tmp/install.sh << 'INSTALL_EOF'
#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "=========================================="
echo "Установка geodrive_n8n-agents"
echo "=========================================="

# Обновление системы
apt-get update -y
apt-get upgrade -y

# Установка необходимых пакетов
apt-get install -y git curl wget nano ufw ca-certificates gnupg lsb-release

# Установка Docker
if ! command -v docker &> /dev/null; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
fi

# Клонирование проекта
cd /root
if [ -d "geodrive_n8n-agents" ]; then
    cd geodrive_n8n-agents
    git pull || true
else
    git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
    cd geodrive_n8n-agents
fi

# Настройка .env
if [ ! -f .env ]; then
    cp env.example .env
fi

# Настройка MCP
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh || true

# Firewall
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable || true

echo "Установка завершена!"
echo "Отредактируйте .env и запустите: docker compose up -d"
INSTALL_EOF

# Отправка скрипта на сервер
scp /tmp/install.sh root@$SERVER_IP:/tmp/install.sh

# Выполнение на сервере
ssh root@$SERVER_IP "chmod +x /tmp/install.sh && bash /tmp/install.sh"

