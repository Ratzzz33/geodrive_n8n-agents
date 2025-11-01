#!/bin/bash
# Полное исправление и перезапуск бота

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Исправление и перезапуск бота"
echo "=========================================="
echo ""

expect << 'ENDOFEXPECT'
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@46.224.17.15

expect {
    "password:" {
        send "enebit7Lschwrkb93vnm\r"
        exp_continue
    }
    "# " {
        # Переходим в директорию проекта
        send "cd /root/geodrive_n8n-agents\r"
        expect "# "
        
        # Обновляем код
        send "echo 'Обновляю код...'\r"
        expect "# "
        send "git pull origin master || git pull origin main || true\r"
        expect "# "
        sleep 2
        
        # Останавливаем все процессы бота
        send "echo 'Останавливаю бота...'\r"
        expect "# "
        send "pkill -9 -f 'tsx.*index.ts' || true\r"
        expect "# "
        send "pkill -9 -f 'node.*dist/index.js' || true\r"
        expect "# "
        send "pkill -9 -f 'npm run dev' || true\r"
        expect "# "
        sleep 3
        
        # Удаляем старые логи
        send "echo 'Очищаю старые логи...'\r"
        expect "# "
        send "rm -f /root/bot.log\r"
        expect "# "
        
        # Проверяем что процессы остановлены
        send "ps aux | grep -E 'tsx|node.*index' | grep -v grep || echo 'Бот остановлен'\r"
        expect "# "
        sleep 2
        
        # Запускаем бота заново
        send "echo 'Запускаю бота...'\r"
        expect "# "
        send "cd /root/geodrive_n8n-agents && nohup npm run dev > /root/bot.log 2>&1 &\r"
        expect "# "
        sleep 5
        
        # Проверяем логи
        send "echo 'Проверяю логи запуска...'\r"
        expect "# "
        send "tail -n 30 /root/bot.log\r"
        expect "# "
        
        # Проверяем что процесс запущен
        send "echo 'Проверяю процессы...'\r"
        expect "# "
        send "ps aux | grep -E 'tsx|node.*index' | grep -v grep\r"
        expect "# "
        
        send "echo 'Готово!'\r"
        expect "# "
        send "exit\r"
        expect eof
    }
    timeout {
        puts "Таймаут подключения"
        exit 1
    }
}
ENDOFEXPECT

echo ""
echo "✅ Команды выполнены!"
echo "💡 Проверьте логи на сервере: tail -f /root/bot.log"

