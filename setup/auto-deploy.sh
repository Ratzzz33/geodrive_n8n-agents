#!/bin/bash
# Полностью автоматический деплой всего проекта
# Использование: HETZNER_TOKEN=your_token ./auto-deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Автоматический деплой geodrive_n8n-agents"
echo "=========================================="
echo ""

# Шаг 0: Настройка hcloud
echo "[0/5] Настройка Hetzner Cloud CLI..."
if [ -f "$SCRIPT_DIR/00-setup-hcloud.sh" ]; then
    chmod +x "$SCRIPT_DIR/00-setup-hcloud.sh"
    if [ -n "$HETZNER_TOKEN" ]; then
        HETZNER_TOKEN="$HETZNER_TOKEN" "$SCRIPT_DIR/00-setup-hcloud.sh"
    else
        "$SCRIPT_DIR/00-setup-hcloud.sh"
    fi
else
    echo "Пропуск (скрипт не найден)"
fi

# Проверка наличия активного контекста
if ! hcloud context list | grep -q "ACTIVE"; then
    echo "Ошибка: Нет активного контекста hcloud."
    echo "Выполните: $SCRIPT_DIR/00-setup-hcloud.sh"
    exit 1
fi

# Шаг 1: Создание SSH ключа (если нет)
echo ""
echo "[1/5] Проверка SSH ключей..."
if ! hcloud ssh-key list 2>/dev/null | grep -q "."; then
    echo "SSH ключи не найдены. Создайте ключ:"
    echo "  ssh-keygen -t ed25519 -C 'your_email@example.com'"
    echo "  hcloud ssh-key create --name geodrive-key --public-key-from-file ~/.ssh/id_ed25519.pub"
    read -p "Продолжить без SSH ключа? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Шаг 2: Создание сервера
echo ""
echo "[2/5] Создание сервера в Hetzner Cloud..."
cd "$PROJECT_ROOT"
chmod +x "$SCRIPT_DIR/01-create-server.sh"
"$SCRIPT_DIR/01-create-server.sh"

# Получение IP адреса
SERVER_NAME="geodrive-n8n"
echo "Ожидание получения IP адреса..."
sleep 5

IP_ADDRESS=$(hcloud server describe "$SERVER_NAME" -o format='{{.PublicNet.IPv4.IP}}' 2>/dev/null || echo "")

if [ -z "$IP_ADDRESS" ]; then
    echo "Не удалось получить IP адрес автоматически."
    echo "Выполните: hcloud server list"
    exit 1
fi

echo "IP адрес сервера: $IP_ADDRESS"

# Шаг 3: Ожидание готовности сервера
echo ""
echo "[3/5] Ожидание готовности сервера..."
echo "Ожидание доступности SSH (может занять до 60 секунд)..."

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@"$IP_ADDRESS" "echo 'Connected'" 2>/dev/null; then
        echo "Сервер готов!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Попытка $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "Не удалось подключиться к серверу. Попробуйте подключиться вручную:"
    echo "  ssh root@$IP_ADDRESS"
    exit 1
fi

# Шаг 4: Копирование файлов на сервер
echo ""
echo "[4/5] Копирование файлов на сервер..."

# Создание директории на сервере
ssh root@"$IP_ADDRESS" "mkdir -p /root/geodrive_n8n-agents"

# Копирование файлов (исключая .git и другие ненужные)
rsync -avz --exclude '.git' --exclude '__pycache__' --exclude '*.pyc' \
    "$PROJECT_ROOT/" root@"$IP_ADDRESS":/root/geodrive_n8n-agents/ || {
    echo "rsync не доступен, используем scp..."
    scp -r "$PROJECT_ROOT"/* root@"$IP_ADDRESS":/root/geodrive_n8n-agents/
}

# Шаг 5: Установка и запуск на сервере
echo ""
echo "[5/5] Установка и запуск сервисов на сервере..."

ssh root@"$IP_ADDRESS" << 'ENDSSH'
cd /root/geodrive_n8n-agents

# Установка Docker
echo "Установка Docker..."
chmod +x setup/02-install-docker.sh
bash setup/02-install-docker.sh

# Выход и повторный вход для применения группы docker
# Но продолжим в этой сессии

# Настройка переменных окружения
if [ ! -f .env ]; then
    echo "Создание .env из примера..."
    cp env.example .env
    echo ""
    echo "ВАЖНО: Отредактируйте .env файл и заполните данные подключения к Neon!"
    echo "Выполните: nano .env"
fi

# Настройка MCP сервера
echo "Настройка MCP сервера..."
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh

# Запуск сервисов
echo "Запуск сервисов..."
chmod +x setup/03-deploy-services.sh
bash setup/03-deploy-services.sh

echo ""
echo "=========================================="
echo "Деплой завершен!"
echo "=========================================="
echo "n8n: http://$IP_ADDRESS:5678"
echo "MCP: http://$IP_ADDRESS:1880"
echo ""
echo "ВАЖНО:"
echo "1. Отредактируйте .env и заполните данные Neon"
echo "2. Перезапустите: docker compose restart"
echo "=========================================="
ENDSSH

echo ""
echo "✓ Автоматический деплой завершен!"
echo ""
echo "Для подключения к серверу:"
echo "  ssh root@$IP_ADDRESS"
echo ""
echo "Для просмотра логов:"
echo "  ssh root@$IP_ADDRESS 'docker compose -f /root/geodrive_n8n-agents/docker-compose.yml logs -f'"

