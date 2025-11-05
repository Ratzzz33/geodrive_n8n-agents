#!/usr/bin/env python3
"""Деплой TypeScript исправлений на сервер"""
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
    
    print("🔌 Connecting to server...")
    if not ssh.connect():
        print("❌ Failed to connect")
        return False
    
    print("\n" + "="*60)
    print("  Deploying TypeScript fixes to Hetzner")
    print("="*60)
    
    commands = [
        ("cd /root/geodrive_n8n-agents && git stash", "Stashing local changes"),
        ("cd /root/geodrive_n8n-agents && git fetch --all", "Fetching latest code"),
        ("cd /root/geodrive_n8n-agents && git reset --hard origin/master", "Resetting to origin/master"),
        ("cd /root/geodrive_n8n-agents && npm install", "Installing dependencies"),
        ("cd /root/geodrive_n8n-agents && npm run build 2>&1", "Building TypeScript"),
        ("pm2 restart jarvis-api playwright-service", "Restarting services"),
        ("sleep 3 && curl -s http://localhost:3001/health", "Health check"),
    ]
    
    for cmd, desc in commands:
        print(f"\n📌 {desc}...")
        output, error, status = ssh.execute(cmd, wait=True)
        
        if status == 0:
            print(f"✅ Success")
            # Показываем последние 10 строк вывода
            if output:
                lines = output.strip().split('\n')
                relevant = lines[-10:] if len(lines) > 10 else lines
                for line in relevant:
                    print(f"   {line}")
        else:
            print(f"❌ Failed (exit code {status})")
            if error:
                print(f"ERROR:\n{error}")
            ssh.close()
            return False
    
    ssh.close()
    print("\n" + "="*60)
    print("✅ DEPLOY COMPLETED!")
    print("="*60)
    print("\n📋 Changes deployed:")
    print("  • Fixed /link_rentprog to use external_refs")
    print("  • Fixed all TypeScript compilation errors")
    print("  • Services restarted successfully")
    print("\n🎯 Next: Test the system!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

