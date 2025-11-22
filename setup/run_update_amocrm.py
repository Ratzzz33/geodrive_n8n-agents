#!/usr/bin/env python3
"""Запуск обновления AmoCRM на сервере с выводом"""

import paramiko
import sys
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to server...")
    ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass', timeout=30)
    print("Connected!\n")
    
    cmd = "cd /root/geodrive_n8n-agents && git pull --no-rebase 2>&1 && export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002 && node scripts/amocrm-update-since-last-sync.mjs 2>&1"
    
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    # Читаем вывод в реальном времени
    while True:
        if stdout.channel.recv_ready():
            data = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
            if data:
                sys.stdout.write(data)
                sys.stdout.flush()
        
        if stderr.channel.recv_stderr_ready():
            data = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
            if data:
                sys.stderr.write(data)
                sys.stderr.flush()
        
        if stdout.channel.exit_status_ready():
            # Читаем остатки
            while stdout.channel.recv_ready():
                data = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                if data:
                    sys.stdout.write(data)
                    sys.stdout.flush()
            break
        
        time.sleep(0.1)
    
    exit_code = stdout.channel.recv_exit_status()
    sys.exit(exit_code)
    
except KeyboardInterrupt:
    print("\n\nInterrupted")
    sys.exit(130)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
finally:
    ssh.close()

