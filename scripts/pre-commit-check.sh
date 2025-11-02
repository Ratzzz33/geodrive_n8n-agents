#!/bin/bash
# Pre-commit проверки

set -e

echo "=========================================="
echo "Pre-commit проверки"
echo "=========================================="

ERRORS=0

# Проверка 1: Валидация ВСЕХ GitHub Actions workflow файлов
echo ""
echo "1. Проверка GitHub Actions workflow файлов..."
if [ -d ".github/workflows" ]; then
    if command -v python3 &> /dev/null; then
        echo "   Запускаю setup/validate_workflows.py..."
        if python3 setup/validate_workflows.py; then
            echo "✅ Все workflow файлы валидны"
        else
            echo "❌ Ошибки в workflow файлах"
            echo ""
            echo "💡 Исправьте ошибки и попробуйте снова."
            echo "   Для подробностей: python3 setup/validate_workflows.py --verbose"
            ERRORS=$((ERRORS + 1))
        fi
    elif command -v python &> /dev/null; then
        echo "   Запускаю setup/validate_workflows.py..."
        if python setup/validate_workflows.py; then
            echo "✅ Все workflow файлы валидны"
        else
            echo "❌ Ошибки в workflow файлах"
            echo ""
            echo "💡 Исправьте ошибки и попробуйте снова."
            echo "   Для подробностей: python setup/validate_workflows.py --verbose"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "⚠️ Python не найден, пропускаем валидацию workflow"
        echo "   Рекомендуется установить Python 3 для полной проверки"
    fi
else
    echo "ℹ️  Директория .github/workflows не найдена, пропускаем"
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

