#!/usr/bin/env python3
"""
Принудительно перезапустить PM2 с ecosystem.config.cjs
"""

import paramiko
import sys

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def force_restart():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)
        
        commands = [
            "cd /root/geodrive_n8n-agents && pm2 stop all",
            "cd /root/geodrive_n8n-agents && pm2 delete all",
            "cd /root/geodrive_n8n-agents && pm2 start ecosystem.config.cjs",
            "cd /root/geodrive_n8n-agents && pm2 save",
            "sleep 3 && pm2 list",
            "sleep 2 && curl -s http://localhost:3002/health",
            "sleep 1 && curl -s -X POST http://localhost:3002/scrape-company-cash -H 'Content-Type: application/json' -d '{\"branch\":\"tbilisi\"}' 2>&1 | head -20",
        ]
        
        for i, cmd in enumerate(commands, 1):
            print(f"\n[{i}/{len(commands)}] {cmd.split('&&')[-1].strip()[:60]}")
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
            output = stdout.read().decode('utf-8', errors='ignore')
            
            # ASCII only
            safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
            lines = safe_output.strip().split('\n')
            
            # Show last 15 lines
            for line in lines[-15:]:
                print(line)
        
        print("\n=== DONE ===")
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False
        
    finally:
        ssh.close()

if __name__ == "__main__":
    success = force_restart()
    sys.exit(0 if success else 1)

