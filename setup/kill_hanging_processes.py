#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH
import signal

print('🔍 Проверяю зависшие процессы...\n')

ssh = ServerSSH()
try:
    ssh.connect()
    
    # Ищем все процессы импорта
    output, _, _ = ssh.execute('ps aux | grep "import_all_rentprog" | grep -v grep')
    
    if output.strip():
        print('⚠️  Найдены процессы импорта:')
        print(output)
        print('\n🛑 Убиваю зависшие процессы...')
        
        # Убиваем все процессы
        ssh.execute('pkill -f "import_all_rentprog"')
        print('✅ Процессы завершены\n')
    else:
        print('✅ Зависших процессов не найдено\n')
    
    # Показываем последние строки лога
    print('📋 Последние строки лога:')
    output, _, _ = ssh.execute('tail -30 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"')
    if output.strip() and 'Лог пуст' not in output:
        print('─' * 60)
        print(output)
        print('─' * 60)
    else:
        print('Лог пуст или недоступен')
    
    ssh.close()
    
except Exception as e:
    print(f'❌ Ошибка: {e}')

