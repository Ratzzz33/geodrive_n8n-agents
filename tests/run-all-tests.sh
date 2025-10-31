#!/bin/bash
# Запуск всех тестов

# Не используем set -e, так как ошибки обрабатываются функцией run_test

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Запуск всех тестов"
echo "=========================================="
echo ""

FAILED_TESTS=0
TOTAL_TESTS=0

# Функция для запуска теста
run_test() {
    local test_file=$1
    local test_name=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Запуск: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if bash "$test_file"; then
        echo ""
        echo "✅ $test_name: ПРОЙДЕН"
        echo ""
    else
        echo ""
        echo "❌ $test_name: ПРОВАЛЕН"
        echo ""
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Запуск тестов
run_test "tests/test-docker-compose.sh" "Тесты Docker Compose"
run_test "tests/test-setup-scripts.sh" "Тесты скриптов установки"
run_test "tests/test-mcp-server.sh" "Тесты MCP сервера"

# Итоги
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ИТОГИ ТЕСТИРОВАНИЯ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Всего тестов: $TOTAL_TESTS"
echo "Пройдено: $((TOTAL_TESTS - FAILED_TESTS))"
echo "Провалено: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!"
    exit 0
else
    echo "❌ Некоторые тесты провалены"
    exit 1
fi

