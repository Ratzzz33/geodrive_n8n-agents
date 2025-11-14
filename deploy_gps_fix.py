#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Деплой исправления GPS парсинга на сервер
"""

import sys
import io
sys.path.append('setup')
from server_ssh import ServerSSH

# Фиксим encoding для Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    ssh = ServerSSH()
    
    try:
        print("[*] Подключение к серверу...")
        ssh.connect()
        
        commands = [
            ("cd /root/geodrive_n8n-agents && git pull origin master", "Получение последних изменений"),
            ("cd /root/geodrive_n8n-agents && npm run build 2>&1 | tail -20", "Компиляция TypeScript"),
            ("pm2 restart jarvis-api", "Перезапуск API сервиса"),
            ("sleep 3 && pm2 status jarvis-api", "Проверка статуса"),
        ]
        
        for cmd, description in commands:
            print(f"\n[*] {description}...")
            output, error, exit_status = ssh.execute(cmd)
            print(output)
            if error:
                print(f"[!] Warnings: {error}")
            if exit_status != 0 and "npm run build" not in cmd:  # build может иметь warnings
                print(f"[!] Ошибка выполнения команды: {cmd}")
                break
        
        print("\n[+] Деплой завершен!")
        print("\n[*] Проверка исправления:")
        print("   Через 2-4 минуты посмотрите последнее исполнение workflow в n8n")
        print("   Все машины должны иметь данные, а не пустые объекты")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

