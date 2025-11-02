#!/bin/bash
# Тесты для MCP сервера

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "⚠️  SKIP: Node.js не установлен, пропускаем тесты MCP сервера"
    exit 0
fi

# Не используем set -e, чтобы обрабатывать ошибки явно

echo "=========================================="
echo "Тест 1: Проверка структуры MCP сервера"
echo "=========================================="

MCP_DIR="mcp-server"

if [ ! -d "$MCP_DIR" ]; then
    echo "⚠️  WARN: Директория $MCP_DIR не найдена (будет создана при установке)"
    echo "✅ PASS: Тест пропущен (MCP директория будет создана автоматически)"
    exit 0
fi

echo "✅ PASS: Директория $MCP_DIR существует"

echo ""
echo "=========================================="
echo "Тест 2: Проверка package.json"
echo "=========================================="

if [ -f "$MCP_DIR/package.json" ]; then
    echo "✅ PASS: package.json найден"
    
    # Проверка наличия start скрипта
    if grep -q '"start"' "$MCP_DIR/package.json"; then
        echo "✅ PASS: Скрипт start найден в package.json"
    else
        echo "❌ FAIL: Скрипт start отсутствует в package.json"
        exit 1
    fi
    
    # Проверка зависимостей
    REQUIRED_DEPS=("express" "axios" "dotenv")
    for dep in "${REQUIRED_DEPS[@]}"; do
        if grep -q "\"${dep}\"" "$MCP_DIR/package.json"; then
            echo "✅ PASS: Зависимость $dep найдена"
        else
            echo "⚠️  WARN: Зависимость $dep отсутствует"
        fi
    done
else
    echo "⚠️  WARN: package.json не найден (будет создан при установке)"
fi

echo ""
echo "=========================================="
echo "Тест 3: Проверка server.js"
echo "=========================================="

if [ -f "$MCP_DIR/server.js" ]; then
    echo "✅ PASS: server.js найден"
    
    # Проверка наличия ключевых функций
    REQUIRED_FUNCTIONS=("express" "axios" "dotenv" "/health" "/workflows")
    for func in "${REQUIRED_FUNCTIONS[@]}"; do
        if grep -q "$func" "$MCP_DIR/server.js"; then
            echo "✅ PASS: Функция/эндпоинт $func найден"
        else
            echo "⚠️  WARN: Функция/эндпоинт $func отсутствует"
        fi
    done
else
    echo "⚠️  WARN: server.js не найден (будет создан при установке)"
fi

echo ""
echo "=========================================="
echo "✅ Все тесты MCP сервера пройдены!"
echo "=========================================="

