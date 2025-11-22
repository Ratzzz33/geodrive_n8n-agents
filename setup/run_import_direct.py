#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH

print('🚀 Запуск импорта напрямую на сервере\n')

ssh = ServerSSH()

try:
    # Подключаемся с коротким таймаутом
    print('🔐 Подключение...')
    ssh.connect(timeout=5)
    print('✅ Подключено\n')
    
    # Убиваем старые процессы если есть
    print('🧹 Очистка старых процессов...')
    ssh.execute('pkill -f "import_all_rentprog" 2>/dev/null; sleep 1')
    print('✅ Очищено\n')
    
    # Запускаем импорт в фоне
    print('🚀 Запускаю импорт...')
    cmd = 'cd /root/geodrive_n8n-agents && nohup node setup/import_all_rentprog_to_db_robust.mjs > /tmp/import_clients.log 2>&1 &'
    output, _, _ = ssh.execute(cmd)
    
    # Сразу проверяем что процесс запустился
    print('⏳ Проверяю процесс...')
    import time
    time.sleep(2)
    output, _, _ = ssh.execute('pgrep -f "import_all_rentprog" | head -1')
    pid = output.strip()
    
    if pid:
        print(f'✅ Процесс запущен (PID: {pid})\n')
        print('📋 Мониторинг:')
        print('   ssh root@46.224.17.15')
        print('   tail -f /tmp/import_clients.log')
    else:
        print('⚠️  Процесс не найден, проверяю лог...')
        output, _, _ = ssh.execute('tail -10 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"', timeout=3)
        print(output)
    
    ssh.close()
    
except Exception as e:
    print(f'❌ Ошибка: {e}')
    try:
        ssh.close()
    except:
        pass

