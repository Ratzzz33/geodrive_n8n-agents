#!/bin/bash
# Финальное автоматическое обновление сервера

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Принудительное обновление сервера"
echo "=========================================="
echo ""

echo "Выполнение команд на сервере..."
echo "Введите пароль когда будет запрошен: $SERVER_PASSWORD"
echo ""

# Создаем команды для выполнения
COMMANDS="cd /root/geodrive_n8n-agents && git fetch origin && git reset --hard origin/master && head -3 docker-compose.yml && docker compose down && docker compose up -d && sleep 5 && docker compose ps"

# Выполняем команды через SSH
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "$COMMANDS"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "Обновление завершено!"
    echo "=========================================="
else
    echo ""
    echo "Ошибка выполнения (код: $EXIT_CODE)"
    echo "Выполните команды вручную:"
    echo "  ssh root@46.224.17.15"
    echo "  cd /root/geodrive_n8n-agents"
    echo "  git fetch origin"
    echo "  git reset --hard origin/master"
    echo "  docker compose down && docker compose up -d"
fi

