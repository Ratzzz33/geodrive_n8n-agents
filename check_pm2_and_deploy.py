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
        
        # Проверим все pm2 процессы
        print("\n[*] Список всех pm2 процессов...")
        output, _, _ = ssh.execute("pm2 list")
        print(output)
        
        # Делаем git pull
        print("\n[*] Git pull...")
        output, error, exit_status = ssh.execute("cd /root/geodrive_n8n-agents && git pull origin master")
        print(output)
        if error:
            print(f"[!] Errors: {error}")
        
        # Перезапускаем ВСЕ процессы
        print("\n[*] Перезапуск всех pm2 процессов...")
        output, _, _ = ssh.execute("cd /root/geodrive_n8n-agents && pm2 restart all")
        print(output)
        
        # Статус после перезапуска
        print("\n[*] Статус после перезапуска...")
        output, _, _ = ssh.execute("pm2 list")
        print(output)
        
        print("\n[+] Готово! Проверьте workflow через 2-4 минуты")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

