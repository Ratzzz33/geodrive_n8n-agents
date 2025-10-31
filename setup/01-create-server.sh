#!/bin/bash
# Скрипт для создания сервера в Hetzner Cloud
# Использование: ./01-create-server.sh

set -e

echo "Создание сервера в Hetzner Cloud..."

# Проверка наличия hcloud
if ! command -v hcloud &> /dev/null; then
    echo "Ошибка: hcloud не найден. Установите Hetzner CLI."
    exit 1
fi

# Проверка контекста
if ! hcloud context list | grep -q "ACTIVE"; then
    echo "Ошибка: Не установлен активный контекст hcloud."
    echo "Выполните: hcloud context create <name>"
    exit 1
fi

# Параметры сервера
SERVER_NAME="geodrive-n8n"
SERVER_TYPE="cpx21"  # 3 vCPU, 4 GB RAM, 80 GB SSD
IMAGE="ubuntu-22.04"
LOCATION="nbg1"  # Nuremberg (можно изменить на hel1, fsn1 и т.д.)

# Получаем директорию скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLOUD_INIT_FILE="$PROJECT_ROOT/setup/cloud-init.yaml"

# Проверка наличия файла cloud-init
if [ ! -f "$CLOUD_INIT_FILE" ]; then
    echo "Предупреждение: cloud-init.yaml не найден. Сервер будет создан без него."
    CLOUD_INIT_ARG=""
else
    CLOUD_INIT_ARG="--user-data-from-file $CLOUD_INIT_FILE"
fi

# Получаем первый SSH ключ
SSH_KEYS=$(hcloud ssh-key list -o columns=name | tail -n +2 | head -1)
if [ -z "$SSH_KEYS" ]; then
    echo "Предупреждение: SSH ключи не найдены. Создайте ключ:"
    echo "  hcloud ssh-key create --name my-key --public-key-from-file ~/.ssh/id_rsa.pub"
    SSH_KEY_ARG=""
else
    SSH_KEY_ARG="--ssh-key $SSH_KEYS"
fi

echo "Параметры создания сервера:"
echo "  Имя: $SERVER_NAME"
echo "  Тип: $SERVER_TYPE"
echo "  Образ: $IMAGE"
echo "  Локация: $LOCATION"
[ -n "$SSH_KEY_ARG" ] && echo "  SSH ключ: $SSH_KEYS"
[ -n "$CLOUD_INIT_ARG" ] && echo "  Cloud-init: $CLOUD_INIT_FILE"

# Создание сервера
if [ -n "$CLOUD_INIT_ARG" ] && [ -n "$SSH_KEY_ARG" ]; then
    hcloud server create \
      --name "$SERVER_NAME" \
      --type "$SERVER_TYPE" \
      --image "$IMAGE" \
      --location "$LOCATION" \
      $SSH_KEY_ARG \
      --user-data-from-file "$CLOUD_INIT_FILE"
elif [ -n "$SSH_KEY_ARG" ]; then
    hcloud server create \
      --name "$SERVER_NAME" \
      --type "$SERVER_TYPE" \
      --image "$IMAGE" \
      --location "$LOCATION" \
      $SSH_KEY_ARG
else
    hcloud server create \
      --name "$SERVER_NAME" \
      --type "$SERVER_TYPE" \
      --image "$IMAGE" \
      --location "$LOCATION"
fi

echo ""
echo "✓ Сервер $SERVER_NAME создан!"
echo ""
echo "Для получения IP адреса выполните:"
echo "  hcloud server describe $SERVER_NAME -o json | grep ipv4"
echo ""
echo "Или просмотрите список серверов:"
echo "  hcloud server list"

