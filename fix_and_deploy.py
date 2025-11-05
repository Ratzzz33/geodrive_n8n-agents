#!/usr/bin/env python3
"""Деплой исправлений на сервер"""
import sys
import os

# Добавляем setup в путь только если мы в корне проекта
script_dir = os.path.dirname(os.path.abspath(__file__))
setup_dir = os.path.join(script_dir, 'setup')
if os.path.exists(setup_dir) and setup_dir not in sys.path:
    sys.path.insert(0, setup_dir)

from server_ssh import ServerSSH

def main():
    ssh = ServerSSH()
    
    print("=== Connecting to server ===")
    if not ssh.connect():
        return False
    
    commands = [
        ("cd /root/geodrive_n8n-agents && git fetch --all && git reset --hard origin/main", "Git reset"),
        ("cd /root/geodrive_n8n-agents && npm install", "NPM install"),
        ("cd /root/geodrive_n8n-agents && npm run build", "NPM build"),
        ("pm2 restart jarvis-api playwright-service", "PM2 restart"),
        ("curl -s http://localhost:3001/health", "Health check"),
    ]
    
    for cmd, desc in commands:
        print(f"\n=== {desc} ===")
        output, error, status = ssh.execute(cmd, wait=True)
        if status == 0:
            print(f"✓ {output[:500]}")
        else:
            print(f"✗ Error: {error[:500]}")
            ssh.close()
            return False
    
    ssh.close()
    print("\n✅ Deploy completed!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

