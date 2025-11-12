#!/bin/bash
# Скрипт для тестирования синхронизации бронирований с замером времени

URL="http://172.18.0.1:3000/sync-bookings"
OUTPUT_FILE="/tmp/sync_timing_result.json"
LOG_FILE="/tmp/sync_timing.log"

echo "=========================================="
echo "🚀 Запуск синхронизации бронирований"
echo "=========================================="
echo "URL: $URL"
echo "Время начала: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

START_TIME=$(date +%s)

# Запускаем синхронизацию
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  --max-time 3600 \
  -o "$OUTPUT_FILE" \
  2>&1 | tee "$LOG_FILE"

EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "=========================================="
echo "✅ Запрос завершен"
echo "=========================================="
echo "Время выполнения: ${DURATION} секунд (${MINUTES} мин ${SECONDS} сек)"
echo "Код выхода: $EXIT_CODE"
echo "Время окончания: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if [ $EXIT_CODE -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
    echo "📊 Результаты:"
    echo "------------------------------------------"
    cat "$OUTPUT_FILE" | python3 -m json.tool 2>/dev/null || cat "$OUTPUT_FILE"
    echo ""
    echo "💾 Полный результат сохранен в: $OUTPUT_FILE"
else
    echo "❌ Ошибка выполнения или таймаут"
    if [ -f "$LOG_FILE" ]; then
        echo "Логи:"
        tail -20 "$LOG_FILE"
    fi
fi

