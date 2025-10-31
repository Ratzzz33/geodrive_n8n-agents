#!/bin/bash
# Bash скрипт для отправки команд установки на сервер

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Установка на сервер $SERVER_IP"
echo "=========================================="
echo ""

# Функция для выполнения команд
run_remote() {
    local cmd="$1"
    echo "Выполнение: $cmd"
    
    # Используем sshpass если доступен, иначе просто ssh
    if command -v sshpass &> /dev/null; then
        sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$cmd"
    else
        echo "sshpass не найден. Используйте: ssh $SERVER_USER@$SERVER_IP"
        echo "Или установите sshpass: apt-get install sshpass (Linux) / brew install hudochenkov/sshpass/sshpass (Mac)"
        ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$cmd"
    fi
}

echo "[1/6] Обновление системы..."
run_remote "export DEBIAN_FRONTEND=noninteractive && apt-get update -y && apt-get upgrade -y"

echo "[2/6] Установка пакетов..."
run_remote "apt-get install -y git curl wget nano ufw ca-certificates gnupg lsb-release"

echo "[3/6] Установка Docker..."
run_remote 'if ! command -v docker &> /dev/null; then
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
fi
docker --version'

echo "[4/6] Клонирование проекта..."
run_remote "cd /root && if [ -d geodrive_n8n-agents ]; then cd geodrive_n8n-agents && git pull; else git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git; fi"

echo "[5/6] Настройка проекта..."
run_remote "cd /root/geodrive_n8n-agents && if [ ! -f .env ]; then cp env.example .env; fi && chmod +x setup/04-setup-mcp-server.sh && bash setup/04-setup-mcp-server.sh || true"

echo "[6/6] Настройка firewall..."
run_remote "ufw allow 22/tcp && ufw allow 5678/tcp && ufw allow 1880/tcp && ufw --force enable || true"

echo ""
echo "=========================================="
echo "Установка завершена!"
echo "=========================================="
echo ""
echo "Подключитесь к серверу:"
echo "  ssh $SERVER_USER@$SERVER_IP"
echo "  Пароль: $SERVER_PASSWORD"
echo ""
echo "Затем:"
echo "  cd /root/geodrive_n8n-agents"
echo "  nano .env  # Заполните данные Neon"
echo "  docker compose up -d"
echo ""

