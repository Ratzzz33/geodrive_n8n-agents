#!/bin/bash
# Скрипт для обновления .env файла на сервере с данными Neon

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "Обновление .env файла на сервере..."

# Данные подключения Neon
cat > /tmp/neon_env.txt << 'EOF'
# n8n настройки
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0

# Neon PostgreSQL настройки
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am

# Neon API ключ (для MCP сервера)
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (генерируется после первого входа в n8n)
N8N_API_KEY=
EOF

# Отправка файла на сервер
if command -v sshpass &> /dev/null; then
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/neon_env.txt "$SERVER_USER@$SERVER_IP:/root/geodrive_n8n-agents/.env"
else
    echo "Используя ssh (потребуется ввод пароля: $SERVER_PASSWORD)"
    scp -o StrictHostKeyChecking=no /tmp/neon_env.txt "$SERVER_USER@$SERVER_IP:/root/geodrive_n8n-agents/.env"
fi

echo "✓ .env файл обновлен на сервере"

