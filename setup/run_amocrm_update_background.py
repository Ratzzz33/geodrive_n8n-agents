#!/usr/bin/env python3
"""
Запуск обновления AmoCRM на сервере в фоне с выводом в консоль
"""

import paramiko
import sys
import time
import threading

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

def read_output(stdout, stderr):
    """Читать вывод из stdout и stderr в отдельном потоке"""
    while True:
        if stdout.channel.recv_ready():
            try:
                data = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                if data:
                    sys.stdout.write(data)
                    sys.stdout.flush()
            except:
                pass
        
        if stderr.channel.recv_stderr_ready():
            try:
                data = stderr.channel.recv_stderr(4096).decode('utf-8', errors='ignore')
                if data:
                    sys.stderr.write(data)
                    sys.stderr.flush()
            except:
                pass
        
        if stdout.channel.exit_status_ready():
            # Читаем остатки
            while stdout.channel.recv_ready():
                try:
                    data = stdout.channel.recv(4096).decode('utf-8', errors='ignore')
                    if data:
                        sys.stdout.write(data)
                        sys.stdout.flush()
                except:
                    pass
            break
        
        time.sleep(0.05)

try:
    sys.stdout.write("Connecting to server 46.224.17.15...\n")
    sys.stdout.flush()
    ssh.connect('46.224.17.15', username='root', password='Geodrive2024SecurePass', timeout=30)
    sys.stdout.write("Connected!\n\n")
    sys.stdout.flush()
    
    cmd = "cd /root/geodrive_n8n-agents && git pull --no-rebase 2>&1 && export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002 && node scripts/amocrm-update-since-last-sync.mjs 2>&1"
    
    sys.stdout.write("Executing command...\n\n")
    sys.stdout.flush()
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    
    # Читаем вывод напрямую в главном потоке
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
        
        time.sleep(0.05)
    
    exit_code = stdout.channel.recv_exit_status()
    print(f"\n\nProcess finished with exit code: {exit_code}", flush=True)
    sys.exit(exit_code)
    
except KeyboardInterrupt:
    print("\n\nInterrupted by user")
    sys.exit(130)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
finally:
    ssh.close()

