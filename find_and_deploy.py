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
        
        # Найти git репозиторий
        print("\n[*] Поиск git репозитория...")
        output, _, _ = ssh.execute("find /root -name '.git' -type d 2>/dev/null | head -5")
        print(output)
        
        # Проверим стандартную локацию
        print("\n[*] Проверка /root/geodrive_n8n-agents...")
        output, _, _ = ssh.execute("ls -la /root/ | grep geodrive")
        print(output)
        
        # Попробуем найти через pm2
        print("\n[*] Проверка рабочей директории pm2...")
        output, _, _ = ssh.execute("pm2 info api-only | grep 'cwd'")
        print(output)
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

