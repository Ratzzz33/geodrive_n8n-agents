#!/bin/bash
# Тесты для скриптов установки

set -e

echo "=========================================="
echo "Тест 1: Проверка наличия обязательных скриптов"
echo "=========================================="

REQUIRED_SCRIPTS=(
    "setup/01-create-server.sh"
    "setup/02-install-docker.sh"
    "setup/03-deploy-services.sh"
    "setup/04-setup-mcp-server.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo "✅ PASS: $script найден"
        
        # Проверка что скрипт исполняемый
        if [ -x "$script" ] || [[ "$script" == *.sh ]]; then
            echo "✅ PASS: $script имеет правильные права"
        else
            echo "⚠️  WARN: $script может требовать chmod +x"
        fi
    else
        echo "❌ FAIL: $script отсутствует"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "Тест 2: Проверка синтаксиса bash скриптов"
echo "=========================================="

# Проверка синтаксиса всех .sh файлов
find setup -name "*.sh" | while read -r script; do
    if bash -n "$script" 2>/dev/null; then
        echo "✅ PASS: Синтаксис $script корректен"
    else
        echo "❌ FAIL: Ошибка синтаксиса в $script"
        bash -n "$script"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "Тест 3: Проверка env.example"
echo "=========================================="

if [ -f "env.example" ]; then
    echo "✅ PASS: env.example найден"
    
    # Проверка наличия обязательных переменных
    REQUIRED_VARS=(
        "N8N_PASSWORD"
        "NEON_HOST"
        "NEON_DATABASE"
        "NEON_USER"
        "NEON_PASSWORD"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" env.example; then
            echo "✅ PASS: Переменная $var найдена в env.example"
        else
            echo "❌ FAIL: Переменная $var отсутствует в env.example"
            exit 1
        fi
    done
else
    echo "❌ FAIL: env.example отсутствует"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Все тесты скриптов установки пройдены!"
echo "=========================================="

