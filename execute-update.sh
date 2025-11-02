#!/bin/bash
# Скрипт для выполнения обновления - введите пароль один раз

echo "=========================================="
echo "Принудительное обновление сервера"
echo "=========================================="
echo ""
echo "Выполнение команд на сервере..."
echo "Введите пароль SSH когда будет запрошен: Geodrive2024SecurePass"
echo ""

ssh root@46.224.17.15 << 'ENDSSH'
cd /root/geodrive_n8n-agents
echo "1. Получение обновлений из репозитория..."
git fetch origin
echo ""
echo "2. Принудительное обновление файлов..."
git reset --hard origin/master
echo ""
echo "3. Проверка docker-compose.yml (первые 3 строки):"
head -3 docker-compose.yml
echo ""
echo "4. Остановка контейнеров..."
docker compose down
echo ""
echo "5. Запуск с обновленной конфигурацией..."
docker compose up -d
echo ""
echo "6. Ожидание запуска..."
sleep 5
echo ""
echo "7. Статус контейнеров:"
docker compose ps
echo ""
echo "=========================================="
echo "Обновление завершено!"
echo "=========================================="
ENDSSH

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✓ Все команды выполнены успешно!"
else
    echo ""
    echo "Ошибка выполнения (код: $EXIT_CODE)"
fi

