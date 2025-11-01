#!/bin/bash
# Проверка статуса бота на сервере

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Проверка статуса бота на сервере $SERVER_IP"
echo "=========================================="
echo ""

# Подключаемся и проверяем
expect << EOF
set timeout 30
spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}
expect {
    "password:" {
        send "${SERVER_PASSWORD}\r"
        exp_continue
    }
    "# " {
        send "echo '=== Проверка процессов бота ==='\r"
        expect "# "
        send "ps aux | grep -E 'tsx|node.*index' | grep -v grep\r"
        expect "# "
        
        send "echo ''\r"
        expect "# "
        send "echo '=== Последние логи бота ==='\r"
        expect "# "
        send "tail -n 30 /root/bot.log 2>/dev/null || echo 'Лог файл не найден'\r"
        expect "# "
        
        send "echo ''\r"
        expect "# "
        send "echo '=== Проверка webhook через Telegram API ==='\r"
        expect "# "
        send "curl -s 'https://api.telegram.org/bot\$(grep TELEGRAM_BOT_TOKEN /root/geodrive_n8n-agents/.env 2>/dev/null | cut -d= -f2)/getWebhookInfo' | head -20\r"
        expect "# "
        
        send "echo ''\r"
        expect "# "
        send "echo '=== Текущая директория и файлы ==='\r"
        expect "# "
        send "cd /root/geodrive_n8n-agents && pwd && ls -la | head -10\r"
        expect "# "
        
        send "exit\r"
        expect eof
    }
}
EOF

