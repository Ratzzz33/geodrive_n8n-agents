#!/bin/bash
# Скрипт для установки Nginx и Certbot на сервере Hetzner

echo "=========================================="
echo "Установка Nginx и Certbot"
echo "=========================================="
echo ""

# Обновление пакетов
echo "1. Обновление списка пакетов..."
apt update -y

# Установка Nginx
echo ""
echo "2. Установка Nginx..."
apt install nginx -y

# Установка Certbot
echo ""
echo "3. Установка Certbot..."
apt install certbot -y

# Установка Certbot plugin для Nginx
echo ""
echo "4. Установка python3-certbot-nginx..."
apt install python3-certbot-nginx -y

# Проверка статуса Nginx
echo ""
echo "5. Проверка статуса Nginx..."
systemctl status nginx --no-pager -l

# Проверка версий
echo ""
echo "=========================================="
echo "Проверка установленных версий:"
echo "=========================================="
nginx -v
certbot --version

echo ""
echo "=========================================="
echo "✅ Установка завершена!"
echo "=========================================="
echo ""
echo "Следующие шаги:"
echo "1. Настройте конфигурацию Nginx для n8n.rentflow.rentals"
echo "2. Получите SSL сертификат: certbot --nginx -d n8n.rentflow.rentals"
echo "3. Получите SSL сертификат для webhook: certbot --nginx -d webhook.rentflow.rentals"

