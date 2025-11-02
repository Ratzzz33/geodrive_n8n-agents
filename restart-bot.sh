#!/bin/bash
# Скрипт для перезапуска бота на сервере Hetzner
# Запустите в Git Bash: bash restart-bot.sh

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Перезапуск бота на сервере $SERVER_IP"
echo "=========================================="
echo ""
echo "Подключаюсь к серверу..."
echo "Пароль будет введен автоматически"
echo ""

# Используем expect если доступен, иначе ручной ввод
if command -v expect &> /dev/null 2>&1; then
    expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}
expect {
    "password:" {
        send "${SERVER_PASSWORD}\r"
        exp_continue
    }
    "# " {
        send "cd /root/geodrive_n8n-agents\r"
        expect "# "
        send "git pull origin master || git pull origin main || true\r"
        expect "# "
        send "pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true\r"
        expect "# "
        send "sleep 2\r"
        expect "# "
        send "nohup npm run dev > /root/bot.log 2>&1 &\r"
        expect "# "
        send "sleep 3\r"
        expect "# "
        send "tail -n 20 /root/bot.log\r"
        expect "# "
        send "exit\r"
        expect eof
    }
}
EOF
else
    echo "⚠️  expect не найден. Выполните команды вручную:"
    echo ""
    echo "ssh ${SERVER_USER}@${SERVER_IP}"
    echo "Пароль: ${SERVER_PASSWORD}"
    echo ""
    echo "После подключения:"
    echo "cd /root/geodrive_n8n-agents"
    echo "git pull"
    echo "pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true"
    echo "sleep 2"
    echo "npm run dev > /root/bot.log 2>&1 &"
    echo "sleep 3"
    echo "tail -n 20 /root/bot.log"
    exit 1
fi

