#!/bin/bash
# Скрипт для деплоя на созданный сервер
# Использование: ./deploy-to-server.sh <IP_ADDRESS> <ROOT_PASSWORD>

set -e

SERVER_IP="${1:-46.224.17.15}"
ROOT_PASSWORD="${2:-enebit7Lschwrkb93vnm}"

echo "Деплой на сервер $SERVER_IP..."

# Установка sshpass если нужно (для автоматического ввода пароля)
if ! command -v sshpass &> /dev/null; then
    echo "Установка sshpass..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y sshpass || true
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass || true
    fi
fi

# Ожидание доступности сервера
echo "Ожидание доступности сервера..."
for i in {1..30}; do
    if sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@"$SERVER_IP" "echo 'Connected'" 2>/dev/null; then
        echo "Сервер доступен!"
        break
    fi
    echo "Попытка $i/30..."
    sleep 2
done

# Обновление системы
echo "Обновление системы..."
sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" << ENDSSH
apt-get update -y
apt-get upgrade -y
ENDSSH

# Установка Docker
echo "Установка Docker..."
sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" << 'ENDSSH'
# Установка зависимостей
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Добавление официального GPG ключа Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Настройка репозитория Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Запуск Docker
systemctl start docker
systemctl enable docker

# Проверка
docker --version
docker compose version
ENDSSH

# Копирование файлов проекта
echo "Копирование файлов проекта..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Создание директории на сервере
sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "mkdir -p /root/geodrive_n8n-agents"

# Копирование файлов
if command -v rsync &> /dev/null; then
    sshpass -p "$ROOT_PASSWORD" rsync -avz --exclude '.git' --exclude '__pycache__' --exclude '*.pyc' \
        "$PROJECT_ROOT/" root@"$SERVER_IP":/root/geodrive_n8n-agents/
else
    # Альтернатива через tar
    cd "$PROJECT_ROOT"
    tar czf /tmp/geodrive_deploy.tar.gz --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' .
    sshpass -p "$ROOT_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/geodrive_deploy.tar.gz root@"$SERVER_IP":/tmp/
    sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "cd /root/geodrive_n8n-agents && tar xzf /tmp/geodrive_deploy.tar.gz && rm /tmp/geodrive_deploy.tar.gz"
    rm /tmp/geodrive_deploy.tar.gz
fi

# Настройка и запуск на сервере
echo "Настройка и запуск сервисов..."
sshpass -p "$ROOT_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" << 'ENDSSH'
cd /root/geodrive_n8n-agents

# Настройка переменных окружения
if [ ! -f .env ]; then
    cp env.example .env
    echo "Файл .env создан. Не забудьте отредактировать его!"
fi

# Настройка MCP сервера
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh || echo "MCP сервер уже настроен"

# Настройка firewall
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable || echo "Firewall уже настроен"

# Запуск сервисов
chmod +x setup/03-deploy-services.sh
bash setup/03-deploy-services.sh || docker compose up -d

echo ""
echo "=========================================="
echo "Деплой завершен!"
echo "=========================================="
echo "n8n: http://46.224.17.15:5678"
echo "MCP: http://46.224.17.15:1880"
echo ""
echo "ВАЖНО: Отредактируйте .env файл:"
echo "  nano /root/geodrive_n8n-agents/.env"
echo "Заполните данные подключения к Neon!"
echo "=========================================="
ENDSSH

echo ""
echo "✓ Деплой завершен!"
echo ""
echo "Подключение к серверу:"
echo "  ssh root@46.224.17.15"
echo ""
echo "Редактирование .env:"
echo "  ssh root@46.224.17.15 'nano /root/geodrive_n8n-agents/.env'"

