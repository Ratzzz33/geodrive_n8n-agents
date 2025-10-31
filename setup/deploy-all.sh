#!/bin/bash
# Полная установка и настройка на сервере через Git Bash

SERVER="root@46.224.17.15"

echo "=========================================="
echo "Подключение к серверу и настройка"
echo "=========================================="

ssh -o StrictHostKeyChecking=no "$SERVER" << 'ENDSSH'
echo "Начало установки..."

# Клонирование проекта если нет
if [ ! -d "/root/geodrive_n8n-agents" ]; then
    echo "Клонирование проекта..."
    cd /root
    git clone https://github.com/Ratzzz33/geodrive_n8n-agents.git
    cd geodrive_n8n-agents
else
    echo "Проект найден, обновляю..."
    cd /root/geodrive_n8n-agents
    git pull || true
fi

# Установка Docker если нет
if ! command -v docker &> /dev/null; then
    echo "Установка Docker..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
    echo "✓ Docker установлен"
else
    echo "✓ Docker уже установлен"
fi

# Создание .env файла
echo "Создание .env файла..."
cat > .env << 'ENVEOF'
# n8n настройки
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0

# Neon PostgreSQL настройки
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am

# Neon API ключ
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (будет заполнен позже)
N8N_API_KEY=
ENVEOF
echo "✓ .env файл создан"

# Настройка MCP сервера
if [ -f "setup/04-setup-mcp-server.sh" ]; then
    echo "Настройка MCP сервера..."
    chmod +x setup/04-setup-mcp-server.sh
    bash setup/04-setup-mcp-server.sh || echo "MCP setup skipped"
fi

# Firewall
echo "Настройка firewall..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 5678/tcp 2>/dev/null || true
ufw allow 1880/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true
echo "✓ Firewall настроен"

# Запуск сервисов
echo "Запуск сервисов..."
docker compose down 2>/dev/null || true
docker compose up -d

echo "Ожидание запуска (15 секунд)..."
sleep 15

echo ""
echo "=========================================="
echo "Статус контейнеров:"
echo "=========================================="
docker compose ps

echo ""
echo "Последние логи n8n:"
docker compose logs --tail=10 n8n

echo ""
echo "=========================================="
echo "✓ Установка завершена!"
echo "=========================================="
echo "Доступ к сервисам:"
echo "  n8n: http://46.224.17.15:5678"
echo "  MCP: http://46.224.17.15:1880"
echo ""
echo "Учетные данные n8n:"
echo "  Логин: admin"
echo "  Пароль: geodrive_secure_pass_2024"
echo "=========================================="
ENDSSH

echo ""
echo "Готово!"

