#!/usr/bin/env python3
import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH

print('🚀 Запуск импорта на сервере\n')

ssh = ServerSSH()
ssh.connect()

# Запускаем в фоне
print('📤 Запускаю импорт...')
output, _, _ = ssh.execute(
    'cd /root/geodrive_n8n-agents && '
    'nohup node setup/import_all_rentprog_to_db_robust.mjs > /tmp/import_clients.log 2>&1 & '
    'sleep 1 && '
    'pgrep -f "import_all_rentprog_to_db_robust"'
)

pid = output.strip()
if pid:
    print(f'✅ Процесс запущен (PID: {pid})\n')
    
    print('⏳ Жду 5 секунд и проверяю лог...\n')
    time.sleep(5)
    
    output, _, _ = ssh.execute('tail -20 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"')
    if output.strip() and 'Лог пуст' not in output:
        print('📋 Последние строки лога:')
        print('─' * 60)
        print(output)
        print('─' * 60)
    else:
        print('⚠️  Лог пока пуст (процесс только начался)')
    
    print('\n✅ Импорт запущен!')
    print('\n📋 Для мониторинга:')
    print('   python setup/monitor_import_simple.py')
    print(f'   ssh root@46.224.17.15 "tail -f /tmp/import_clients.log"')
else:
    print('❌ Не удалось запустить процесс')

ssh.close()

