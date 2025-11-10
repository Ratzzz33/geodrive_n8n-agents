#!/usr/bin/env python3
"""
Деплой syncEmployeeCash.ts на сервер
"""

import paramiko
import sys
from pathlib import Path

SERVER_HOST = '46.224.17.15'
SERVER_USER = 'root'
SERVER_PASSWORD = 'WNHeg7U7aiKw'
REMOTE_PATH = '/root/geodrive_n8n-agents/src/api/routes/syncEmployeeCash.ts'
LOCAL_PATH = Path(__file__).parent.parent / 'src' / 'api' / 'routes' / 'syncEmployeeCash.ts'

def deploy_file():
    try:
        # Читаем локальный файл
        with open(LOCAL_PATH, 'r', encoding='utf-8') as f:
            file_content = f.read()
        
        print(f'[INFO] Reading file: {LOCAL_PATH}')
        print(f'       Size: {len(file_content)} bytes\n')
        
        # Подключаемся к серверу
        print(f'[INFO] Connecting to {SERVER_USER}@{SERVER_HOST}...')
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(SERVER_HOST, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        print('       [OK] Connected\n')
        
        # Копируем файл
        print(f'[INFO] Copying file to server...')
        sftp = ssh.open_sftp()
        
        # Создаем временный файл
        temp_path = '/tmp/syncEmployeeCash.ts'
        with sftp.file(temp_path, 'w') as f:
            f.write(file_content)
        
        # Создаем директорию если нужно
        ssh.exec_command('mkdir -p /root/geodrive_n8n-agents/src/api/routes')
        
        # Перемещаем в нужное место
        stdin, stdout, stderr = ssh.exec_command(f'mv {temp_path} {REMOTE_PATH}')
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            raise Exception(f'Error moving file: {error}')
        
        sftp.close()
        print(f'       [OK] File copied: {REMOTE_PATH}\n')
        
        # Перезапускаем API
        print('[INFO] Restarting Jarvis API...')
        stdin, stdout, stderr = ssh.exec_command('pm2 restart jarvis-api')
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            print(f'       [WARN] PM2 restart failed: {error}')
            print('       [INFO] Trying to start manually...')
            stdin, stdout, stderr = ssh.exec_command('pkill -9 -f "tsx.*api-only"; cd /root/geodrive_n8n-agents && pm2 start npm --name jarvis-api -- run start:api')
            exit_status = stdout.channel.recv_exit_status()
        
        print('       [OK] API restarted\n')
        
        # Ждем запуска
        import time
        time.sleep(5)
        
        # Проверяем endpoint
        print('[INFO] Checking API health...')
        stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
        output = stdout.read().decode('utf-8')
        
        if 'ok' in output.lower():
            print('       [OK] API is working!')
        else:
            print(f'       [WARN] Health check response: {output[:100]}')
        
        ssh.close()
        print('\n[OK] Deployment completed!')
        
    except Exception as e:
        print(f'\n[ERROR] Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    deploy_file()

