#!/bin/bash
# Установка Jarvis API как systemd сервис

set -e

echo "🚀 Установка Jarvis API как systemd сервис..."
echo ""

# 1. Копируем service файл
echo "1️⃣  Копирование service файла..."
sudo cp /root/geodrive_n8n-agents/setup/jarvis-api.service /etc/systemd/system/
echo "✅ Service файл скопирован"
echo ""

# 2. Перезагружаем systemd
echo "2️⃣  Перезагрузка systemd daemon..."
sudo systemctl daemon-reload
echo "✅ Daemon перезагружен"
echo ""

# 3. Включаем автозапуск
echo "3️⃣  Включение автозапуска..."
sudo systemctl enable jarvis-api.service
echo "✅ Автозапуск включен"
echo ""

# 4. Останавливаем старые процессы
echo "4️⃣  Остановка старых процессов..."
pkill -f 'node.*dist/api' 2>/dev/null || true
sleep 2
echo "✅ Старые процессы остановлены"
echo ""

# 5. Запускаем сервис
echo "5️⃣  Запуск Jarvis API сервиса..."
sudo systemctl start jarvis-api.service
sleep 5
echo "✅ Сервис запущен"
echo ""

# 6. Проверяем статус
echo "6️⃣  Проверка статуса..."
sudo systemctl status jarvis-api.service --no-pager -l
echo ""

# 7. Проверяем логи
echo "7️⃣  Последние логи (20 строк)..."
sudo journalctl -u jarvis-api.service -n 20 --no-pager
echo ""

echo "✅ Установка завершена!"
echo ""
echo "📝 Полезные команды:"
echo "   sudo systemctl status jarvis-api    # Статус сервиса"
echo "   sudo systemctl restart jarvis-api   # Перезапуск"
echo "   sudo systemctl stop jarvis-api      # Остановка"
echo "   sudo journalctl -u jarvis-api -f    # Логи в реальном времени"
echo "   tail -f /var/log/jarvis-api.log     # Stdout логи"
echo "   tail -f /var/log/jarvis-api-error.log # Stderr логи"
