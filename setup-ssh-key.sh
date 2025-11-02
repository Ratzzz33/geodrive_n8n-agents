#!/bin/bash
# Настройка SSH ключа для автоматической аутентификации

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "Настройка SSH ключа для автоматического подключения..."

# Проверка наличия ключа
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "Создание SSH ключа..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" -q
fi

echo ""
echo "Копирование ключа на сервер..."
echo "Введите пароль когда будет запрошен: $SERVER_PASSWORD"

# Копирование ключа на сервер
ssh-copy-id -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << EOF
$SERVER_PASSWORD
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "SSH ключ настроен! Теперь можно подключаться без пароля."
    echo ""
    echo "Выполнение команд на сервере..."
    ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /root/geodrive_n8n-agents
git fetch origin
git reset --hard origin/master
head -3 docker-compose.yml
docker compose down
docker compose up -d
sleep 5
docker compose ps
ENDSSH
else
    echo "Ошибка настройки SSH ключа. Выполните вручную."
fi

