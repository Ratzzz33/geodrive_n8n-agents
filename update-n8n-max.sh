#!/bin/bash
# Скрипт для обновления n8n до максимальной версии без ограничений

echo "=========================================="
echo "Обновление n8n до максимальной версии"
echo "=========================================="
echo ""

SERVER_IP="46.224.17.15"
SERVER_USER="root"

echo "Подключение к серверу и обновление..."
echo "Введите пароль SSH когда будет запрошен: enebit7Lschwrkb93vnm"
ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /root/geodrive_n8n-agents

echo "1. Обновление кода из репозитория..."
git pull || echo "Git pull пропущен"

echo ""
echo "2. Остановка контейнеров..."
docker compose down

echo ""
echo "3. Обновление образа n8n..."
docker compose pull

echo ""
echo "4. Запуск с новыми настройками..."
docker compose up -d

echo ""
echo "5. Ожидание запуска (10 секунд)..."
sleep 10

echo ""
echo "6. Статус контейнеров:"
docker compose ps

echo ""
echo "7. Логи n8n (последние 30 строк):"
docker compose logs --tail=30 n8n

echo ""
echo "=========================================="
echo "Обновление завершено!"
echo "=========================================="
echo "Доступ к n8n: http://46.224.17.15:5678"
echo "Логин: admin"
echo "Пароль: geodrive_secure_pass_2024"
EOF

echo ""
echo "Готово! n8n обновлен до максимальной версии."

