#!/usr/bin/env python3
"""
Запуск HTTP Scraper Service на сервере через PM2
"""

import paramiko
import sys

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def start_service():
    """Запустить HTTP scraper service"""
    
    print("Connecting to server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(
            SERVER_IP,
            username=SERVER_USER,
            password=SERVER_PASSWORD,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        
        # Остановить все и запустить с ecosystem.config.cjs
        commands = [
            "cd /root/geodrive_n8n-agents && pm2 delete all",
            "cd /root/geodrive_n8n-agents && pm2 start ecosystem.config.cjs",
            "cd /root/geodrive_n8n-agents && pm2 save",
            "pm2 list",
            "sleep 2 && curl -s http://localhost:3002/health",
        ]
        
        for i, cmd in enumerate(commands, 1):
            print(f"\n[{i}/{len(commands)}] {cmd.split('&&')[-1].strip()}")
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
            
            output = stdout.read().decode('utf-8', errors='ignore')
            exit_status = stdout.channel.recv_exit_status()
            
            # ASCII-only output
            safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
            print(safe_output[-500:] if len(safe_output) > 500 else safe_output)
            
            if exit_status != 0:
                print(f"WARNING: exit code {exit_status}")
        
        print("\n=== SERVICE STARTED ===")
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False
        
    finally:
        ssh.close()

if __name__ == "__main__":
    success = start_service()
    sys.exit(0 if success else 1)

