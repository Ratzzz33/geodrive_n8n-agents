#!/bin/bash
# Скрипт для просмотра логов service-center-webhook

LOG_DIR="/var/log/nginx"
ACCESS_LOG="$LOG_DIR/service-center-webhook-access.log"
ERROR_LOG="$LOG_DIR/service-center-webhook-error.log"

echo "=== Просмотр логов service-center-webhook ==="
echo ""

# Проверка существования логов
if [ ! -f "$ACCESS_LOG" ]; then
    echo "⚠️  Файл access log не найден: $ACCESS_LOG"
    echo "   Возможно, логи еще не созданы или nginx не перезагружен"
else
    echo "✓ Access log найден: $ACCESS_LOG"
    echo "  Размер: $(du -h "$ACCESS_LOG" | cut -f1)"
    echo ""
fi

if [ ! -f "$ERROR_LOG" ]; then
    echo "⚠️  Файл error log не найден: $ERROR_LOG"
else
    echo "✓ Error log найден: $ERROR_LOG"
    echo "  Размер: $(du -h "$ERROR_LOG" | cut -f1)"
    echo ""
fi

# Меню
echo "Выберите действие:"
echo "1) Последние 50 запросов (access log)"
echo "2) Последние 50 ошибок (error log)"
echo "3) Логи за последний час"
echo "4) Логи за последние 10 минут"
echo "5) Поиск по IP адресу"
echo "6) Поиск по статусу (например, 404, 500)"
echo "7) Показать все уникальные IP адреса"
echo "8) Показать статистику по статусам"
echo "9) Мониторинг в реальном времени (tail -f)"
echo "0) Выход"
echo ""

read -p "Ваш выбор: " choice

case $choice in
    1)
        echo ""
        echo "=== Последние 50 запросов ==="
        tail -n 50 "$ACCESS_LOG" 2>/dev/null || echo "Файл недоступен"
        ;;
    2)
        echo ""
        echo "=== Последние 50 ошибок ==="
        tail -n 50 "$ERROR_LOG" 2>/dev/null || echo "Файл недоступен"
        ;;
    3)
        echo ""
        echo "=== Логи за последний час ==="
        if [ -f "$ACCESS_LOG" ]; then
            since=$(date -d '1 hour ago' '+%d/%b/%Y:%H:%M:%S')
            awk -v since="$since" '$4 >= "["since {print}' "$ACCESS_LOG" 2>/dev/null || echo "Ошибка чтения лога"
        else
            echo "Файл недоступен"
        fi
        ;;
    4)
        echo ""
        echo "=== Логи за последние 10 минут ==="
        if [ -f "$ACCESS_LOG" ]; then
            since=$(date -d '10 minutes ago' '+%d/%b/%Y:%H:%M:%S')
            awk -v since="$since" '$4 >= "["since {print}' "$ACCESS_LOG" 2>/dev/null || echo "Ошибка чтения лога"
        else
            echo "Файл недоступен"
        fi
        ;;
    5)
        read -p "Введите IP адрес: " ip
        echo ""
        echo "=== Запросы с IP $ip ==="
        grep "$ip" "$ACCESS_LOG" 2>/dev/null | tail -n 50 || echo "Не найдено запросов с этого IP"
        ;;
    6)
        read -p "Введите статус (например, 404, 500): " status
        echo ""
        echo "=== Запросы со статусом $status ==="
        grep " $status " "$ACCESS_LOG" 2>/dev/null | tail -n 50 || echo "Не найдено запросов со статусом $status"
        ;;
    7)
        echo ""
        echo "=== Уникальные IP адреса ==="
        awk '{print $1}' "$ACCESS_LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -20 || echo "Файл недоступен"
        ;;
    8)
        echo ""
        echo "=== Статистика по статусам ==="
        awk '{print $9}' "$ACCESS_LOG" 2>/dev/null | sort | uniq -c | sort -rn || echo "Файл недоступен"
        ;;
    9)
        echo ""
        echo "=== Мониторинг в реальном времени (Ctrl+C для выхода) ==="
        tail -f "$ACCESS_LOG" "$ERROR_LOG" 2>/dev/null || echo "Файлы недоступны"
        ;;
    0)
        echo "Выход..."
        exit 0
        ;;
    *)
        echo "Неверный выбор"
        exit 1
        ;;
esac
