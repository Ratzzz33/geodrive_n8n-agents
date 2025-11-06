#!/usr/bin/env python3
"""
Проверка логов HTTP Scraper
"""

import paramiko

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def check_logs():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        
        cmd = "cat /root/geodrive_n8n-agents/logs/http-scraper-service-error-2.log"
        
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
        output = stdout.read().decode('utf-8', errors='ignore')
        
        # ASCII only
        safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
        
        print("=== HTTP SCRAPER ERROR LOG ===")
        print(safe_output)
        
    finally:
        ssh.close()

if __name__ == "__main__":
    check_logs()

