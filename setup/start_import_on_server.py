import paramiko
import time
import os

print('🔐 Подключаюсь к серверу...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass', timeout=10)

print('📤 Копирую скрипт на сервер...')

# Читаем локальный файл
with open('setup/import_all_rentprog_to_db_robust.mjs', 'r', encoding='utf-8') as f:
    script_content = f.read()

# Создаем файл на сервере
sftp = ssh.open_sftp()
try:
    sftp.mkdir('/root/geodrive_n8n-agents/setup', mode=0o755)
except:
    pass

with sftp.open('/root/geodrive_n8n-agents/setup/import_all_rentprog_to_db_robust.mjs', 'w') as remote_file:
    remote_file.write(script_content)
sftp.close()

print('✅ Скрипт скопирован\n')

print('🚀 Запускаю импорт в фоне...')

# Запускаем в фоне через nohup с выводом в лог
stdin, stdout, stderr = ssh.exec_command(
    'cd /root/geodrive_n8n-agents && '
    'nohup node setup/import_all_rentprog_to_db_robust.mjs > /tmp/import_clients.log 2>&1 & '
    'echo $!'
)

pid = stdout.read().decode().strip()
print(f'✅ Процесс запущен (PID: {pid})\n')

print('📋 Команды для мониторинга:')
print(f'   ssh root@46.224.17.15')
print(f'   tail -f /tmp/import_clients.log')
print(f'   ps aux | grep {pid}')
print('')
print('🛑 Остановить:')
print(f'   kill {pid}')

ssh.close()

