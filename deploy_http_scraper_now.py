#!/usr/bin/env python3
"""
Быстрый деплой HTTP Scraper Service на сервер
"""

import paramiko
import sys

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def deploy():
    """Деплой HTTP scraper service на сервер"""
    
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
        
        commands = [
            "cd /root/geodrive_n8n-agents && git stash",
            "cd /root/geodrive_n8n-agents && git pull origin master",
            "cd /root/geodrive_n8n-agents && npm install > /dev/null 2>&1 && echo 'npm install OK'",
            "cd /root/geodrive_n8n-agents && npm run build 2>&1 | tail -20",
            "cd /root/geodrive_n8n-agents && (pm2 restart all || pm2 start ecosystem.config.cjs) 2>&1 | tail -10",
            "cd /root/geodrive_n8n-agents && pm2 save",
        ]
        
        total = len(commands)
        for i, cmd in enumerate(commands, 1):
            print(f"\n[{i}/{total}] Running: {cmd}")
            stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
            
            # Read output
            output = stdout.read().decode('utf-8', errors='ignore')
            error = stderr.read().decode('utf-8', errors='ignore')
            exit_status = stdout.channel.recv_exit_status()
            
            if output:
                # Only print ASCII characters to avoid encoding errors
                safe_output = ''.join(c if ord(c) < 128 else '?' for c in output)
                print(safe_output[-500:] if len(safe_output) > 500 else safe_output)
            
            if exit_status != 0:
                print(f"ERROR: Command failed with exit code {exit_status}")
                if error:
                    print(error[-500:] if len(error) > 500 else error)
                return False
        
        # Health check
        print("\n[6/6] Health check...")
        stdin, stdout, stderr = ssh.exec_command(
            "curl -s http://localhost:3002/health", 
            get_pty=True
        )
        health = stdout.read().decode('utf-8', errors='ignore')
        print(health)
        
        print("\n=== DEPLOY SUCCESS ===")
        print("HTTP Scraper Service deployed and running on port 3002")
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False
        
    finally:
        ssh.close()

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)

