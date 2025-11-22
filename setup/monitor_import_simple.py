#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH

print('🔍 Проверка импорта на сервере...\n')

ssh = ServerSSH()
try:
    ssh.connect()
    
    # Проверяем процесс
    output, _, _ = ssh.execute('pgrep -f "import_all_rentprog_to_db_robust" | head -1')
    pid = output.strip()
    
    if pid:
        print(f'✅ Процесс работает (PID: {pid})\n')
        
        # Последние 15 строк лога
        output, _, _ = ssh.execute('tail -15 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"')
        if output.strip() and output.strip() != 'Лог пуст':
            print('📋 Последние строки лога:')
            print('─' * 60)
            print(output)
            print('─' * 60)
        else:
            print('⚠️  Лог пока пуст (процесс только начался)')
    else:
        print('⚠️  Процесс не найден (возможно завершён)\n')
        # Показываем последние строки лога
        output, _, _ = ssh.execute('tail -30 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"')
        if output.strip() and output.strip() != 'Лог пуст':
            print('📋 Последние строки лога:')
            print('─' * 60)
            print(output)
            print('─' * 60)
    
    ssh.close()
    
except Exception as e:
    print(f'❌ Ошибка: {e}')

