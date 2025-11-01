#!/bin/bash
# Перезапуск бота с использованием expect для автоматического ввода пароля

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

# Проверяем наличие expect
if ! command -v expect &> /dev/null; then
    echo "❌ expect не найден. Устанавливаю через apt-get (требует sudo)..."
    echo "💡 Для Windows через Git Bash: установите expect отдельно"
    echo ""
    echo "Попробуем через простой SSH (потребуется ручной ввод пароля):"
    ssh ${SERVER_USER}@${SERVER_IP}
    exit 1
fi

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
    timeout {
        puts "Ошибка: таймаут подключения"
        exit 1
    }
}
EOF

