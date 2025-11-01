#!/bin/bash
# Скрипт для обновления переменных окружения на сервере

echo "=========================================="
echo "Обновление переменных окружения n8n"
echo "=========================================="
echo ""

ssh root@46.224.17.15 << 'ENDSSH'
cd /root/geodrive_n8n-agents

echo "1. Получение обновлений..."
git pull

echo ""
echo "2. Остановка контейнера..."
docker compose down

echo ""
echo "3. Запуск с новыми переменными..."
docker compose up -d

echo ""
echo "4. Ожидание запуска..."
sleep 5

echo ""
echo "5. Статус контейнера:"
docker compose ps

echo ""
echo "=========================================="
echo "Готово! Переменные окружения обновлены."
echo "=========================================="
echo ""
echo "Используйте в workflow:"
echo "  - {{ \$env.RENTPROG_HEALTH_URL }}"
echo "  - {{ \$env.TELEGRAM_ALERT_CHAT_ID }}"
echo "  - {{ \$env.API_BASE_URL }}"
ENDSSH

echo ""
echo "Обновление завершено!"

