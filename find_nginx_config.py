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
        
        # Поиск конфигов n8n
        print("\n[*] Поиск конфигов Nginx для n8n...")
        output, _, _ = ssh.execute("find /etc/nginx -name '*n8n*' -o -name '*rentflow*' 2>/dev/null")
        print(output if output else "Конфиги не найдены")
        
        # Проверка sites-available
        print("\n[*] Содержимое /etc/nginx/sites-available...")
        output, _, _ = ssh.execute("ls -la /etc/nginx/sites-available/")
        print(output)
        
        # Проверка sites-enabled
        print("\n[*] Содержимое /etc/nginx/sites-enabled...")
        output, _, _ = ssh.execute("ls -la /etc/nginx/sites-enabled/")
        print(output)
        
        # Проверка default конфига
        print("\n[*] Проверка default конфига...")
        output, _, _ = ssh.execute("grep -n 'n8n.rentflow.rentals' /etc/nginx/sites-enabled/default 2>/dev/null | head -5")
        print(output if output else "n8n.rentflow.rentals не найден в default")
        
        # Проверка всех конфигов
        print("\n[*] Поиск упоминаний n8n во всех конфигах...")
        output, _, _ = ssh.execute("grep -r 'n8n' /etc/nginx/sites-enabled/ 2>/dev/null | head -10")
        print(output if output else "Упоминаний n8n не найдено")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

