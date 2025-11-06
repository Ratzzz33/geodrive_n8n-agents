#!/usr/bin/env python3
"""
Деплой функционала сохранения платежей в БД
"""

import sys
import os

# Add setup directory to path
setup_dir = os.path.join(os.path.dirname(__file__), 'setup')
if setup_dir not in sys.path:
    sys.path.insert(0, setup_dir)

from server_ssh import ServerSSH

SERVER_IP = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = "Geodrive2024SecurePass"

def deploy():
    print("=" * 50)
    print("DEPLOYING PAYMENTS FEATURE")
    print("=" * 50)
    
    ssh = ServerSSH(SERVER_IP, SERVER_USER, SERVER_PASSWORD)
    
    if not ssh.connect():
        print("ERROR: Failed to connect to server")
        return False
    
    try:
        # 1. Git operations
        print("\n1. Updating code from git...")
        ssh.execute_multiple([
            "cd /root/geodrive_n8n-agents",
            "git stash",
            "git pull origin master"
        ])
        
        # 2. Install dependencies
        print("\n2. Installing dependencies...")
        ssh.execute("cd /root/geodrive_n8n-agents && npm install")
        
        # 3. Build TypeScript
        print("\n3. Building TypeScript...")
        result = ssh.execute("cd /root/geodrive_n8n-agents && npm run build")
        if result and result[2] != 0:
            print("ERROR: Build failed")
            return False
        
        # 4. Restart http-scraper-service
        print("\n4. Restarting http-scraper-service...")
        ssh.execute("cd /root/geodrive_n8n-agents && pm2 restart http-scraper-service")
        
        # 5. Check status
        print("\n5. Checking service status...")
        ssh.execute("pm2 ls")
        
        # 6. Check logs
        print("\n6. Recent logs:")
        ssh.execute("pm2 logs http-scraper-service --lines 10 --nostream")
        
        print("\n" + "=" * 50)
        print("DEPLOYMENT COMPLETE")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False
    finally:
        ssh.close()

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)

