#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from server_ssh import ServerSSH
import time

print('🚀 Деплой и запуск импорта на сервере\n')

ssh = ServerSSH()
ssh.connect()

# 1. Копируем скрипт
print('📤 Копирую скрипт на сервер...')
with open('setup/import_all_rentprog_to_db_robust.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

ssh.execute(f"cat > /root/geodrive_n8n-agents/setup/import_all_rentprog_to_db_robust.mjs << 'EOFMARKER'\n{content}\nEOFMARKER")
print('✅ Скрипт скопирован\n')

# 2. Запускаем в фоне
print('🚀 Запускаю импорт в фоне...')
output, _, _ = ssh.execute(
    'cd /root/geodrive_n8n-agents && '
    'nohup node setup/import_all_rentprog_to_db_robust.mjs > /tmp/import_clients.log 2>&1 & '
    'echo $!'
)
pid = output.strip().split('\n')[-1]
print(f'✅ Процесс запущен (PID: {pid})\n')

# 3. Ждём немного и проверяем
print('⏳ Жду 3 секунды...')
time.sleep(3)

print('🔍 Проверяю что процесс работает...')
output, _, _ = ssh.execute(f'ps -p {pid} -o pid,cmd --no-headers')
if output.strip():
    print(f'✅ Процесс жив: {output.strip()}')
else:
    print('⚠️  Процесс не найден')

print('\n📋 Команды для мониторинга:')
print('   python setup/monitor_import.py')
print(f'   ssh root@46.224.17.15 "tail -f /tmp/import_clients.log"')
print(f'   ssh root@46.224.17.15 "ps aux | grep {pid}"')

ssh.close()

