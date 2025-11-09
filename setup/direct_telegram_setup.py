#!/usr/bin/env python3
"""Direct setup of TELEGRAM_ALERT_CHAT_ID via SSH"""
import paramiko
import time

SERVER = "46.224.17.15"
USER = "root"
PASSWORD = "Geodrive2024SecurePass"
CHAT_ID = "-5004140602"

print("\n[*] Connecting to server...")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(SERVER, username=USER, password=PASSWORD, timeout=30, look_for_keys=False, allow_agent=False)
    print("[+] Connected successfully!\n")
    
    commands = [
        "cd /root/geodrive_n8n-agents",
        "grep 'TELEGRAM_ALERT_CHAT_ID' docker-compose.yml || echo '[NOT_FOUND]'",
        f"sed -i '/services:/,/n8n:/{{/environment:/a\\      - TELEGRAM_ALERT_CHAT_ID={CHAT_ID}' docker-compose.yml 2>&1 || echo '[ADDING_FAILED]'",
        "docker compose restart n8n",
        "sleep 10",
        "docker exec n8n printenv | grep TELEGRAM || echo '[VAR_NOT_SET]'"
    ]
    
    for cmd in commands:
        print(f"[>] {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
        output = stdout.read().decode('utf-8', errors='ignore')
        error = stderr.read().decode('utf-8', errors='ignore')
        
        if output:
            print(output.strip())
        if error and '[' not in error:
            print(f"[!] {error.strip()}")
        print()
        
        time.sleep(1)
    
    print("[+] Setup completed!")
    print("[*] Check workflow: https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj\n")
    
except Exception as e:
    print(f"[!] Error: {e}")
finally:
    client.close()

