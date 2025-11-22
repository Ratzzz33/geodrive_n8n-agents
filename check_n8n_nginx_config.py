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
        
        # Содержимое конфига
        print("\n[*] Содержимое n8n.rentflow.rentals.conf...")
        output, _, _ = ssh.execute("cat /etc/nginx/sites-available/n8n.rentflow.rentals.conf")
        print(output)
        
        # Проверка синтаксиса nginx
        print("\n[*] Проверка синтаксиса Nginx...")
        output, error, exit_status = ssh.execute("nginx -t 2>&1")
        print(output)
        if error:
            print(f"[!] Errors: {error}")
        
        # Проверка SSL сертификатов
        print("\n[*] Проверка SSL сертификатов...")
        output, _, _ = ssh.execute("ls -la /etc/letsencrypt/live/n8n.rentflow.rentals/ 2>&1")
        print(output)
        
        # Попробуем перезагрузить nginx
        print("\n[*] Перезагрузка Nginx...")
        output, error, _ = ssh.execute("systemctl reload nginx 2>&1")
        print(output if output else "OK")
        if error:
            print(f"[!] Errors: {error}")
        
        # Проверка доступности через curl с заголовками
        print("\n[*] Проверка доступности https://n8n.rentflow.rentals...")
        output, _, _ = ssh.execute("curl -I https://n8n.rentflow.rentals 2>&1 | head -10")
        print(output)
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

