#!/bin/bash
# Простой скрипт для проверки статуса на сервере
# Запустите в Git Bash: bash check-status.sh

echo "=========================================="
echo "Подключение к серверу для проверки"
echo "=========================================="
echo "При запросе введите пароль: Geodrive2024SecurePass"
echo ""

ssh -o StrictHostKeyChecking=no root@46.224.17.15 << 'CHECKSCRIPT'
cd /root/geodrive_n8n-agents

echo ""
echo "=========================================="
echo "1. Статус контейнеров:"
echo "=========================================="
docker compose ps

echo ""
echo "=========================================="
echo "2. Логи MCP сервера (последние 50):"
echo "=========================================="
docker compose logs mcp-server --tail=50 2>&1

echo ""
echo "=========================================="
echo "3. Структура mcp-server:"
echo "=========================================="
ls -la mcp-server/ 2>&1 | head -20

echo ""
echo "=========================================="
echo "4. Проверка package.json в mcp-server:"
echo "=========================================="
[ -f mcp-server/package.json ] && cat mcp-server/package.json || echo "package.json не найден"

echo ""
echo "=========================================="
echo "5. Логи n8n (последние 10 строк):"
echo "=========================================="
docker compose logs n8n --tail=10 2>&1

echo ""
echo "=========================================="
echo "Проверка завершена"
echo "=========================================="
CHECKSCRIPT

echo ""
echo "Готово!"

