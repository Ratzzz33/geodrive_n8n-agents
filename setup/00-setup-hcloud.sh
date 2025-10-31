#!/bin/bash
# Скрипт для автоматической настройки hcloud контекста
# Использование: 
#   HETZNER_TOKEN=your_token ./00-setup-hcloud.sh
#   или
#   ./00-setup-hcloud.sh (запросит токен интерактивно)

set -e

CONTEXT_NAME="geodrive"

echo "Настройка Hetzner Cloud CLI контекста..."

# Проверка наличия hcloud
if ! command -v hcloud &> /dev/null; then
    echo "Ошибка: hcloud не найден. Установите Hetzner CLI."
    exit 1
fi

# Проверка существующего контекста
if hcloud context list | grep -q "ACTIVE.*$CONTEXT_NAME"; then
    echo "Контекст '$CONTEXT_NAME' уже активен."
    hcloud context list
    exit 0
fi

# Получение токена
if [ -z "$HETZNER_TOKEN" ]; then
    echo "Введите ваш Hetzner Cloud API токен:"
    echo "(Вы можете создать его в https://console.hetzner.cloud/ -> Settings -> API Tokens)"
    read -s HETZNER_TOKEN
    echo ""
fi

if [ -z "$HETZNER_TOKEN" ]; then
    echo "Ошибка: Токен не предоставлен."
    exit 1
fi

# Создание контекста неинтерактивно
echo "Создание контекста '$CONTEXT_NAME'..."

# Используем переменную окружения для неинтерактивного создания
export HCLOUD_TOKEN="$HETZNER_TOKEN"

# Проверка токена
if ! hcloud server-type list &>/dev/null; then
    echo "Ошибка: Неверный токен или нет доступа."
    exit 1
fi

# Сохранение контекста через конфигурационный файл
CONFIG_DIR="$HOME/.config/hcloud"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/contexts.yaml" << EOF
contexts:
  $CONTEXT_NAME:
    token: $HETZNER_TOKEN
active-context: $CONTEXT_NAME
EOF

echo "Контекст '$CONTEXT_NAME' создан и активирован!"

# Проверка
hcloud context list

echo ""
echo "✓ Настройка завершена!"

