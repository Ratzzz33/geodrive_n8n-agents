#!/bin/bash
# Скрипт для выполнения команд на сервере через Git Bash

SERVER="root@46.224.17.15"
PASSWORD="Geodrive2024SecurePass"

echo "Подключение к серверу..."
echo "Пароль: Geodrive2024SecurePass"
echo ""

# Проверяем наличие expect для автоматизации ввода пароля
if command -v expect &> /dev/null; then
    echo "Использую expect для автоматического подключения..."
    expect << EOF
spawn ssh -o StrictHostKeyChecking=no $SERVER
expect "password:"
send "$PASSWORD\r"
expect "# "
send "cd /root/geodrive_n8n-agents\r"
expect "# "
send "docker compose ps\r"
expect "# "
send "docker compose logs mcp-server --tail=50\r"
expect "# "
send "ls -la mcp-server/ 2>/dev/null || echo 'mcp-server directory check'\r"
expect "# "
send "exit\r"
expect eof
EOF
else
    echo "expect не установлен. Выполняю команды через прямой SSH..."
    echo "Введите пароль при запросе: Geodrive2024SecurePass"
    ssh -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd /root/geodrive_n8n-agents
echo "=========================================="
echo "Статус контейнеров:"
echo "=========================================="
docker compose ps

echo ""
echo "=========================================="
echo "Логи MCP сервера (последние 50 строк):"
echo "=========================================="
docker compose logs mcp-server --tail=50

echo ""
echo "=========================================="
echo "Проверка структуры mcp-server:"
echo "=========================================="
ls -la mcp-server/ 2>/dev/null || echo "Директория mcp-server не найдена"

echo ""
echo "=========================================="
echo "Проверка файлов в корне:"
echo "=========================================="
ls -la | grep -E "(docker-compose|package.json|\.env)"

echo ""
echo "=========================================="
ENDSSH
fi

