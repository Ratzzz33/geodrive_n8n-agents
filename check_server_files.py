#!/usr/bin/env python3
"""
Проверка файлов на сервере
"""

import paramiko

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def check_files():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        
        commands = [
            "cat /root/geodrive_n8n-agents/ecosystem.config.cjs",
            "ls -la /root/geodrive_n8n-agents/dist/services/",
            "ls -la /root/geodrive_n8n-agents/src/services/",
        ]
        
        for cmd in commands:
            print(f"\n{'='*60}")
            print(f"CMD: {cmd}")
            print('='*60)
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
            output = stdout.read().decode('utf-8', errors='ignore')
            safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(safe_output)
        
    finally:
        ssh.close()

if __name__ == "__main__":
    check_files()

