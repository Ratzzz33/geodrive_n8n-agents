#!/bin/bash
# Pre-commit проверки

set -e

echo "=========================================="
echo "Pre-commit проверки"
echo "=========================================="

ERRORS=0

# Проверка 1: YAML синтаксис workflow
echo ""
echo "1. Проверка YAML синтаксиса .github/workflows/ci.yml..."
if [ -f ".github/workflows/ci.yml" ]; then
    # Проверка базовой структуры YAML
    if grep -q "^name:" .github/workflows/ci.yml && grep -q "^on:" .github/workflows/ci.yml && grep -q "^jobs:" .github/workflows/ci.yml; then
        echo "✅ YAML структура выглядит корректной"
    else
        echo "⚠️ Возможны проблемы с YAML структурой workflow"
    fi
    
    # Детальная проверка через Python (если доступен с PyYAML)
    if command -v python3 &> /dev/null; then
        if python3 -c "import yaml" 2>/dev/null; then
            if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null; then
                echo "✅ YAML синтаксис валидирован через PyYAML"
            else
                echo "❌ Ошибка YAML синтаксиса в .github/workflows/ci.yml"
                python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 | head -5
                ERRORS=$((ERRORS + 1))
            fi
        fi
    elif command -v python &> /dev/null; then
        if python -c "import yaml" 2>/dev/null; then
            if python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>/dev/null; then
                echo "✅ YAML синтаксис валидирован через PyYAML"
            else
                echo "❌ Ошибка YAML синтаксиса в .github/workflows/ci.yml"
                python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 | head -5
                ERRORS=$((ERRORS + 1))
            fi
        fi
    fi
fi

# Проверка 2: Синтаксис bash скриптов
echo ""
echo "2. Проверка синтаксиса bash скриптов..."
BASH_ERRORS=0
find tests -name "*.sh" -type f | while read -r script; do
    if ! bash -n "$script" 2>/dev/null; then
        echo "❌ Ошибка синтаксиса в $script"
        bash -n "$script" 2>&1 | head -5
        BASH_ERRORS=$((BASH_ERRORS + 1))
    fi
done

if [ $BASH_ERRORS -eq 0 ]; then
    echo "✅ Все bash скрипты синтаксически корректны"
else
    ERRORS=$((ERRORS + BASH_ERRORS))
fi

# Проверка 3: Docker Compose синтаксис
echo ""
echo "3. Проверка docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
    # Создаем временный .env если нужно
    if [ ! -f ".env" ]; then
        cat > .env.test << 'EOF'
N8N_PASSWORD=test_password
N8N_HOST=0.0.0.0
NEON_HOST=test.neon.tech
NEON_PORT=5432
NEON_DATABASE=testdb
NEON_USER=testuser
NEON_PASSWORD=testpass
NEON_API_KEY=test_api_key
N8N_API_KEY=test_n8n_key
EOF
        ENV_FILE=".env.test"
    else
        ENV_FILE=".env"
    fi
    
    if docker compose --env-file "$ENV_FILE" config > /dev/null 2>&1; then
        echo "✅ docker-compose.yml синтаксически корректен"
        rm -f .env.test
    else
        echo "❌ Ошибка в docker-compose.yml"
        docker compose --env-file "$ENV_FILE" config 2>&1 | head -10
        rm -f .env.test
        ERRORS=$((ERRORS + 1))
    fi
fi

# Итоги
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ Все проверки пройдены!"
    exit 0
else
    echo "❌ Найдено ошибок: $ERRORS"
    echo "Исправьте ошибки перед коммитом"
    exit 1
fi

