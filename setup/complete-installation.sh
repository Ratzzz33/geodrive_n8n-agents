#!/bin/bash
# Полная автоматическая установка на сервере
# Этот скрипт выполняется на самом сервере

set -e

echo "=========================================="
echo "Автоматическая установка geodrive_n8n-agents"
echo "=========================================="
echo ""

# Параметры
PROJECT_DIR="/root/geodrive_n8n-agents"
REPO_URL="https://github.com/Ratzzz33/geodrive_n8n-agents.git"

# Шаг 1: Обновление системы
echo "[1/7] Обновление системы..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Шаг 2: Установка необходимых пакетов
echo "[2/7] Установка необходимых пакетов..."
apt-get install -y \
    git \
    curl \
    wget \
    nano \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release

# Шаг 3: Установка Docker
echo "[3/7] Установка Docker..."
if ! command -v docker &> /dev/null; then
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
    
    echo "✓ Docker установлен"
else
    echo "✓ Docker уже установлен"
fi

# Проверка установки Docker
docker --version
docker compose version

# Шаг 4: Клонирование проекта
echo "[4/7] Клонирование проекта..."
if [ -d "$PROJECT_DIR" ]; then
    echo "Директория уже существует, обновляю..."
    cd "$PROJECT_DIR"
    git pull || echo "Не удалось обновить (возможно новые файлы)"
else
    cd /root
    git clone "$REPO_URL" "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Шаг 5: Настройка переменных окружения
echo "[5/7] Настройка переменных окружения..."
if [ ! -f .env ]; then
    cp env.example .env
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте файл .env и заполните данные подключения к Neon!"
    echo "   Выполните: nano $PROJECT_DIR/.env"
    echo ""
else
    echo "✓ Файл .env уже существует"
fi

# Шаг 6: Настройка MCP сервера
echo "[6/7] Настройка MCP сервера..."
chmod +x setup/04-setup-mcp-server.sh
bash setup/04-setup-mcp-server.sh || echo "MCP сервер уже настроен или произошла ошибка"

# Шаг 7: Настройка firewall и запуск сервисов
echo "[7/7] Настройка firewall и запуск сервисов..."

# Firewall
ufw allow 22/tcp
ufw allow 5678/tcp
ufw allow 1880/tcp
ufw --force enable || echo "Firewall уже настроен"

# Запуск сервисов (только если .env настроен правильно)
if grep -q "NEON_HOST=your-project" .env 2>/dev/null; then
    echo ""
    echo "⚠️  ВНИМАНИЕ: Файл .env содержит примеры значений!"
    echo "   Отредактируйте .env перед запуском сервисов:"
    echo "   nano $PROJECT_DIR/.env"
    echo ""
    echo "   Затем запустите:"
    echo "   cd $PROJECT_DIR"
    echo "   docker compose up -d"
else
    echo "Запуск сервисов..."
    docker compose down 2>/dev/null || true
    docker compose up -d
    
    echo "Ожидание запуска сервисов..."
    sleep 10
    
    echo ""
    echo "Проверка статуса контейнеров..."
    docker compose ps
fi

echo ""
echo "=========================================="
echo "Установка завершена!"
echo "=========================================="
echo ""
echo "Доступ к сервисам:"
echo "  n8n:     http://$(hostname -I | awk '{print $1}'):5678"
echo "  MCP:     http://$(hostname -I | awk '{print $1}'):1880"
echo ""
echo "Если сервисы не запустились, проверьте:"
echo "  1. Файл .env настроен правильно"
echo "  2. Данные подключения к Neon корректны"
echo "  3. Логи: docker compose logs"
echo ""
echo "Полезные команды:"
echo "  docker compose ps          - статус контейнеров"
echo "  docker compose logs -f     - просмотр логов"
echo "  docker compose restart     - перезапуск"
echo "  docker compose down        - остановка"
echo "=========================================="

