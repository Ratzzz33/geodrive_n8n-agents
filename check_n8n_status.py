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
        
        # Проверка docker контейнеров
        print("\n[*] Проверка Docker контейнеров...")
        output, _, _ = ssh.execute("docker ps -a | grep n8n")
        print(output)
        
        # Статус контейнера n8n
        print("\n[*] Детали контейнера n8n...")
        output, _, _ = ssh.execute("docker inspect n8n --format='{{.State.Status}} - {{.State.Health.Status}}'")
        print(f"Status: {output}")
        
        # Логи n8n (последние 50 строк)
        print("\n[*] Последние логи n8n...")
        output, _, _ = ssh.execute("docker logs n8n --tail 50")
        print(output)
        
        # Проверка портов
        print("\n[*] Проверка портов...")
        output, _, _ = ssh.execute("netstat -tulpn | grep 5678")
        print(output if output else "Порт 5678 не слушает")
        
        # Nginx статус
        print("\n[*] Статус Nginx...")
        output, _, _ = ssh.execute("systemctl status nginx --no-pager | head -20")
        print(output)
        
        # Проверка конфига nginx для n8n
        print("\n[*] Конфиг Nginx для n8n...")
        output, _, _ = ssh.execute("grep -A 10 'server_name n8n.rentflow.rentals' /etc/nginx/sites-enabled/n8n.conf")
        print(output)
        
        # Попытка локального curl
        print("\n[*] Локальная проверка доступности...")
        output, _, _ = ssh.execute("curl -I http://localhost:5678 2>&1 | head -5")
        print(output)
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

