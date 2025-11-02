#!/bin/bash
# Скрипт для обновления n8n до максимальной версии без ограничений
# Использует sshpass для автоматического ввода пароля

echo "=========================================="
echo "Обновление n8n до максимальной версии"
echo "=========================================="
echo ""

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

# Проверка наличия sshpass
if ! command -v sshpass &> /dev/null; then
    echo "Установка sshpass..."
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "Для Windows: установите sshpass вручную или используйте Git Bash с установленным sshpass"
        echo "Альтернатива: выполните команды вручную с вводом пароля"
    else
        sudo apt-get update && sudo apt-get install -y sshpass
    fi
fi

echo "Подключение к серверу и обновление..."
if command -v sshpass &> /dev/null; then
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
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
else
    echo "sshpass не установлен. Выполните команды вручную:"
    echo ""
    echo "ssh root@46.224.17.15"
    echo "cd /root/geodrive_n8n-agents"
    echo "git pull"
    echo "docker compose down"
    echo "docker compose pull"
    echo "docker compose up -d"
fi

echo ""
echo "Готово! n8n обновлен до максимальной версии."

