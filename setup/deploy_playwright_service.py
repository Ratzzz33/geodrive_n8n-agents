#!/usr/bin/env python3
"""
Скрипт для деплоя Playwright Service на удаленный сервер
Запускает сервис через systemd с логированием в journalctl
"""

import os
import sys
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from setup.server_ssh import ServerSSH

# Конфигурация
SERVER_HOST = "46.224.17.15"
SERVER_USER = "root"
SERVER_PASSWORD = os.getenv("SERVER_PASSWORD", "Geodrive2024SecurePass")
PROJECT_DIR = "/root/geodrive_n8n-agents"
SERVICE_NAME = "playwright-amocrm"

def main():
    print("Deploying Playwright Service to server...")
    
    ssh = ServerSSH()
    try:
        ssh.connect()
        
        # 1. Проверяем наличие файлов
        print("\n[1/8] Checking files on server...")
        result, _, _ = ssh.execute(f"cd {PROJECT_DIR} && test -f services/playwright-amocrm.ts && echo 'OK' || echo 'MISSING'")
        if "OK" not in result:
            print("ERROR: File services/playwright-amocrm.ts not found on server!")
            print("   First run git pull on server or copy files manually")
            return 1
        
        # 2. Устанавливаем зависимости
        print("\n[2/8] Installing dependencies...")
        ssh.execute(f"cd {PROJECT_DIR} && npm install")
        
        # 3. Создаем systemd service файл
        print("\n[3/8] Creating systemd service...")
        
        service_content = f"""[Unit]
Description=AmoCRM Playwright Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={PROJECT_DIR}
Environment="NODE_ENV=production"
EnvironmentFile={PROJECT_DIR}/.env
ExecStart=/usr/bin/npx tsx services/playwright-amocrm.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
        
        # Записываем service файл
        ssh.execute(f"cat > /tmp/playwright-amocrm.service << 'EOFSERVICE'\n{service_content}\nEOFSERVICE")
        ssh.execute("sudo mv /tmp/playwright-amocrm.service /etc/systemd/system/playwright-amocrm.service")
        
        # 4. Перезагружаем systemd
        print("\n[4/8] Reloading systemd...")
        ssh.execute("systemctl daemon-reload")
        
        # 5. Останавливаем старый сервис (если запущен)
        print("\n[5/8] Stopping old service (if running)...")
        ssh.execute("systemctl stop playwright-amocrm || true")
        
        # 6. Запускаем сервис
        print("\n[6/8] Starting Playwright Service...")
        ssh.execute("systemctl enable playwright-amocrm")
        ssh.execute("systemctl start playwright-amocrm")
        
        # 7. Проверяем статус
        print("\n[7/8] Checking status...")
        try:
            status, _, _ = ssh.execute("systemctl is-active playwright-amocrm")
            print(f"Service status: {status.strip()}")
        except:
            print("Could not get service status")
        
        # 8. Показываем последние логи
        print("\n[8/8] Last 20 log lines:")
        try:
            logs, _, _ = ssh.execute("journalctl -u playwright-amocrm -n 20 --no-pager 2>/dev/null")
            # Фильтруем специальные символы для Windows
            logs_clean = logs.encode('ascii', 'ignore').decode('ascii')
            print(logs_clean)
        except Exception as e:
            print(f"Could not get logs: {e}")
        
        print("\nSUCCESS: Deployment completed!")
        print("\nUseful commands:")
        print("  View logs: npm run logs:playwright")
        print("  Status: ssh root@46.224.17.15 'systemctl status playwright-amocrm'")
        print("  Stop: ssh root@46.224.17.15 'systemctl stop playwright-amocrm'")
        print("  Restart: ssh root@46.224.17.15 'systemctl restart playwright-amocrm'")
        
        return 0
        
    except Exception as e:
        print(f"ERROR: {e}")
        return 1
    finally:
        ssh.close()

if __name__ == "__main__":
    sys.exit(main())

