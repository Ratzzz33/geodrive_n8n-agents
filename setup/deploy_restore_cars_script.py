#!/usr/bin/env python3
"""
Деплой restore_cars_from_rentprog.mjs на сервер
"""

import paramiko
import sys
from pathlib import Path

SERVER_HOST = '46.224.17.15'
SERVER_USER = 'root'
SERVER_PASSWORD = 'WNHeg7U7aiKw'
REMOTE_PATH = '/root/geodrive_n8n-agents/setup/restore_cars_from_rentprog.mjs'
LOCAL_PATH = Path(__file__).parent.parent / 'setup' / 'restore_cars_from_rentprog.mjs'

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
        temp_path = '/tmp/restore_cars_from_rentprog.mjs'
        with sftp.file(temp_path, 'w') as f:
            f.write(file_content)
        
        # Создаем директорию если нужно
        ssh.exec_command('mkdir -p /root/geodrive_n8n-agents/setup')
        
        # Перемещаем в нужное место
        stdin, stdout, stderr = ssh.exec_command(f'mv {temp_path} {REMOTE_PATH}')
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            raise Exception(f'Error moving file: {error}')
        
        # Делаем файл исполняемым
        ssh.exec_command(f'chmod +x {REMOTE_PATH}')
        
        sftp.close()
        print(f'       [OK] File copied: {REMOTE_PATH}\n')
        
        # Проверяем, что файл на месте
        stdin, stdout, stderr = ssh.exec_command(f'ls -la {REMOTE_PATH}')
        output = stdout.read().decode('utf-8')
        print(f'       [INFO] File info: {output.strip()}\n')
        
        ssh.close()
        print('[OK] Deployment completed!')
        
    except Exception as e:
        print(f'\n[ERROR] Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    deploy_file()

