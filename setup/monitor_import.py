import paramiko
import time
import sys

def check_progress():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass', timeout=5)
        
        # Проверяем процесс
        stdin, stdout, stderr = ssh.exec_command('pgrep -f "import_all_rentprog_to_db_robust"')
        pids = stdout.read().decode().strip()
        
        if not pids:
            print('⚠️  Процесс не найден (возможно завершён)')
            return False
        
        print(f'✅ Процесс работает (PID: {pids})')
        
        # Читаем последние строки лога
        stdin, stdout, stderr = ssh.exec_command('tail -20 /tmp/import_clients.log 2>/dev/null || echo "Лог пуст"')
        logs = stdout.read().decode()
        
        if logs.strip():
            print('\n📋 Последние строки лога:')
            print('─' * 60)
            print(logs)
            print('─' * 60)
        else:
            print('⚠️  Лог пуст (процесс только начался)')
        
        ssh.close()
        return True
        
    except Exception as e:
        print(f'❌ Ошибка подключения: {e}')
        return False

if __name__ == '__main__':
    print('🔍 Проверяю прогресс импорта...\n')
    check_progress()
