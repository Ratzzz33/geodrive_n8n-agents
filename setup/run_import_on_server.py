import paramiko
import time

# Подключение к серверу
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

print('🔐 Подключаюсь к серверу...')
ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass')

print('📤 Копирую скрипт на сервер...')

# Читаем локальный файл
with open('setup/import_all_rentprog_to_db.mjs', 'r', encoding='utf-8') as f:
    script_content = f.read()

# Создаем файл на сервере
sftp = ssh.open_sftp()
with sftp.open('/root/geodrive_n8n-agents/setup/import_all_rentprog_to_db.mjs', 'w') as remote_file:
    remote_file.write(script_content)
sftp.close()

print('✅ Скрипт скопирован\n')

print('🚀 Запускаю импорт в фоне...')

# Запускаем в фоне через nohup
stdin, stdout, stderr = ssh.exec_command(
    'cd /root/geodrive_n8n-agents && nohup node setup/import_all_rentprog_to_db.mjs > logs/import_clients.log 2>&1 &'
)

# Получаем PID
time.sleep(1)
stdin, stdout, stderr = ssh.exec_command('pgrep -f "import_all_rentprog_to_db"')
pid = stdout.read().decode().strip()

print(f'✅ Процесс запущен (PID: {pid})')
print('')
print('📋 Мониторинг логов:')
print('   ssh root@46.224.17.15')
print('   tail -f /root/geodrive_n8n-agents/logs/import_clients.log')
print('')
print('🛑 Остановить:')
print(f'   kill {pid}')

ssh.close()

