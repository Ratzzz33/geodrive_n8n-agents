#!/bin/bash
# Тест получения HTML маршрутов на сервере

DEVICE_ID=864107072502972
DATE_FROM=2025-11-12
DATE_TO=2025-11-12

echo "📤 Отправляю запрос к API на сервере..."
echo "Устройство: Toyota RAV4 EP021EP ($DEVICE_ID)"
echo "Период: $DATE_FROM - $DATE_TO"
echo ""

curl -X POST http://localhost:3000/starline/routes-html \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": $DEVICE_ID, \"dateFrom\": \"$DATE_FROM\", \"dateTo\": \"$DATE_TO\"}" \
  --max-time 180 \
  -o "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html" \
  -w "\n📊 Статус: %{http_code}\n📊 Размер: %{size_download} байт\n📊 Время: %{time_total} сек\n"

if [ -f "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html" ]; then
  SIZE=$(stat -f%z "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html" 2>/dev/null || stat -c%s "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html" 2>/dev/null || echo "0")
  echo ""
  echo "✅ HTML файл создан: starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html"
  echo "📊 Размер: $SIZE байт"
  echo ""
  echo "📄 Первые 3000 символов:"
  head -c 3000 "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html"
  echo ""
  echo "..."
  echo ""
  echo "📄 Последние 1500 символов:"
  tail -c 1500 "starline-routes-${DEVICE_ID}-${DATE_FROM}-${DATE_TO}.html"
fi

