#!/usr/bin/env python3
"""Быстрое обновление Playwright сервиса на сервере"""

from server_ssh import ServerSSH
import time

def main():
    ssh = ServerSSH()
    
    print("🔌 Подключение к серверу...")
    if not ssh.connect():
        print("❌ Ошибка подключения!")
        return False
    
    commands = [
        ("cd /root/geodrive_n8n-agents && git pull", "Git pull"),
        ("cd /root/geodrive_n8n-agents && npx playwright install chromium", "Install Chromium"),
        ("pm2 restart playwright-service", "Restart service"),
    ]
    
    for cmd, desc in commands:
        print(f"\n▶️  {desc}...")
        output, error, status = ssh.execute(cmd, wait=True)
        if status == 0:
            print(f"✅ {desc} - OK")
            if output:
                print(output[:200])  # Первые 200 символов
        else:
            print(f"❌ {desc} - Error")
            if error:
                print(error[:200])
    
    print("\n🧪 Проверка работы...")
    time.sleep(2)
    output, error, status = ssh.execute("curl -s http://localhost:3001/health", wait=True)
    print(output)
    
    ssh.close()
    print("\n✅ Готово!")
    return True

if __name__ == "__main__":
    main()

