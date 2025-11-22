import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass')

print('📊 Проверяю прогресс импорта...\n')

# Проверяем запущен ли процесс
stdin, stdout, stderr = ssh.exec_command('pgrep -f "import_all_rentprog_to_db"')
pids = stdout.read().decode().strip()

if pids:
    print(f'✅ Процесс работает (PID: {pids})\n')
else:
    print('⚠️  Процесс не найден (возможно уже завершён)\n')

# Читаем логи
stdin, stdout, stderr = ssh.exec_command('tail -50 /root/geodrive_n8n-agents/logs/import_clients.log 2>/dev/null || echo "Лог пока пуст"')
logs = stdout.read().decode()

print('📋 Последние 50 строк лога:\n')
print(logs)

ssh.close()
