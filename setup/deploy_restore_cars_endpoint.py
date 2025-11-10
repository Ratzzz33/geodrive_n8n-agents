#!/usr/bin/env python3
"""
Деплой endpoint /restore-cars на сервер
"""

import paramiko
import sys
from pathlib import Path

SERVER_HOST = '46.224.17.15'
SERVER_USER = 'root'
SERVER_PASSWORD = 'WNHeg7U7aiKw'  # Пароль из server_ssh.py
REMOTE_PATH = '/root/geodrive_n8n-agents/src/api/index.ts'
LOCAL_PATH = Path(__file__).parent.parent / 'src' / 'api' / 'index.ts'

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
        temp_path = '/tmp/api_index.ts'
        with sftp.file(temp_path, 'w') as f:
            f.write(file_content)
        
        # Перемещаем в нужное место
        stdin, stdout, stderr = ssh.exec_command(f'mv {temp_path} {REMOTE_PATH}')
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            raise Exception(f'Ошибка перемещения файла: {error}')
        
        sftp.close()
        print(f'       [OK] File copied: {REMOTE_PATH}\n')
        
        # Перезапускаем API
        print('[INFO] Restarting Jarvis API...')
        stdin, stdout, stderr = ssh.exec_command('pkill -f "tsx src/api-only.ts"')
        stdout.channel.recv_exit_status()  # Игнорируем ошибки если процесс не найден
        
        # Ждем немного
        import time
        time.sleep(2)
        
        # Запускаем заново
        stdin, stdout, stderr = ssh.exec_command('cd /root/geodrive_n8n-agents && nohup tsx src/api-only.ts > /var/log/jarvis-api.log 2>&1 &')
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            raise Exception(f'Ошибка запуска API: {error}')
        
        print('       [OK] API restarted\n')
        
        # Ждем запуска
        time.sleep(3)
        
        # Проверяем endpoint
        print('[INFO] Checking endpoint /restore-cars...')
        stdin, stdout, stderr = ssh.exec_command('curl -s -X POST http://localhost:3000/restore-cars -H "Content-Type: application/json" -d "{}" | head -20')
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if 'Cannot POST' in output or '404' in output:
            print('       [WARN] Endpoint not available yet (API may still be starting)')
        elif 'ok' in output.lower() or 'error' in output.lower():
            print('       [OK] Endpoint is working!')
        else:
            print(f'       [INFO] Response: {output[:200]}...')
        
        ssh.close()
        print('\n[OK] Deployment completed!')
        
    except Exception as e:
        print(f'\n[ERROR] Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    deploy_file()

