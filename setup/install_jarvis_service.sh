#!/bin/bash
# Установка Jarvis API как systemd service с автозапуском

set -e

echo "🚀 Установка Jarvis API как systemd service..."
echo ""

# Проверяем что мы на сервере
if [ ! -d "/root/geodrive_n8n-agents" ]; then
  echo "❌ Ошибка: директория /root/geodrive_n8n-agents не найдена"
  exit 1
fi

cd /root/geodrive_n8n-agents

# Останавливаем старый процесс
echo "1️⃣  Останавливаем старый процесс..."
pkill -f 'node.*dist/api' || true
sleep 2

# Копируем service файл
echo "2️⃣  Копируем service файл..."
cp setup/jarvis-api.service /etc/systemd/system/jarvis-api.service
chmod 644 /etc/systemd/system/jarvis-api.service

# Перезагружаем systemd
echo "3️⃣  Перезагружаем systemd..."
systemctl daemon-reload

# Включаем автозапуск
echo "4️⃣  Включаем автозапуск..."
systemctl enable jarvis-api.service

# Запускаем сервис
echo "5️⃣  Запускаем сервис..."
systemctl start jarvis-api.service

# Ждем инициализации
echo "⏳ Ждем 15 секунд для инициализации Starline scraper..."
sleep 15

# Проверяем статус
echo ""
echo "6️⃣  Проверка статуса:"
systemctl status jarvis-api.service --no-pager || true

echo ""
echo "📊 Проверка логов (последние 30 строк):"
journalctl -u jarvis-api.service --no-pager -n 30 || tail -30 /var/log/jarvis-api.log

echo ""
echo "✅ Установка завершена!"
echo ""
echo "💡 Полезные команды:"
echo "   systemctl status jarvis-api    # Статус сервиса"
echo "   systemctl restart jarvis-api   # Перезапуск"
echo "   systemctl stop jarvis-api      # Остановка"
echo "   journalctl -u jarvis-api -f    # Логи в реальном времени"
echo "   systemctl disable jarvis-api   # Отключить автозапуск"

