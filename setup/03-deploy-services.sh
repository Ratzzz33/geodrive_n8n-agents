#!/bin/bash
# Скрипт для деплоя n8n и MCP сервера

set -e

echo "Проверка Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker не установлен. Запустите сначала ./02-install-docker.sh"
    exit 1
fi

echo "Проверка файла .env..."
if [ ! -f .env ]; then
    echo "Файл .env не найден. Создайте его на основе .env.example"
    echo "cp .env.example .env"
    echo "Затем отредактируйте .env и заполните все необходимые переменные"
    exit 1
fi

echo "Остановка существующих контейнеров..."
docker compose down 2>/dev/null || true

echo "Запуск сервисов..."
docker compose up -d

echo "Ожидание запуска сервисов..."
sleep 10

echo "Проверка статуса контейнеров..."
docker compose ps

echo ""
echo "=========================================="
echo "Сервисы развернуты!"
echo "=========================================="
echo "n8n доступен по адресу: http://localhost:5678"
echo "MCP сервер доступен по адресу: http://localhost:1880"
echo ""
echo "Для просмотра логов:"
echo "  docker compose logs -f n8n"
echo "  docker compose logs -f mcp-server"
echo ""
echo "Для остановки:"
echo "  docker compose down"
echo "=========================================="

