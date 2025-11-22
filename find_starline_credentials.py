#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import io
sys.path.append('setup')
from server_ssh import ServerSSH

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    ssh = ServerSSH()
    
    try:
        print("[*] Подключение к серверу...")
        ssh.connect()
        
        # Проверка переменных окружения в docker-compose.yml
        print("\n[*] Переменные Starline в docker-compose.yml:")
        output, _, _ = ssh.execute("grep -i starline /root/geodrive_n8n-agents/docker-compose.yml")
        print(output if output else "Не найдено")
        
        # Проверка .env файла
        print("\n[*] Переменные Starline в .env:")
        output, _, _ = ssh.execute("grep -i starline /root/geodrive_n8n-agents/.env 2>/dev/null")
        print(output if output else "Не найдено или нет доступа")
        
        # Проверка переменных окружения в pm2
        print("\n[*] Переменные окружения в процессе jarvis-api:")
        output, _, _ = ssh.execute("pm2 env jarvis-api | grep -i starline")
        print(output if output else "Не найдено")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

