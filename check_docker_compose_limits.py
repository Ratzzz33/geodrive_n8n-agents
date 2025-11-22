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
        
        # Полная секция n8n из docker-compose.yml
        print("\n[*] Секция n8n в docker-compose.yml:")
        print("=" * 60)
        output, _, _ = ssh.execute("sed -n '/^  n8n:/,/^  [^ ]/p' /root/geodrive_n8n-agents/docker-compose.yml | head -50")
        print(output)
        
        # Рекомендация
        print("\n[*] РЕКОМЕНДАЦИЯ:")
        print("=" * 60)
        print("Текущие лимиты контейнера установлены через Docker runtime,")
        print("а не через docker-compose.yml. Возможно они были установлены")
        print("при первом запуске контейнера.")
        print("\nРекомендуемые лимиты для сервера с 3.7GB RAM:")
        print("  mem_limit: 2.5g     # 2.5GB максимум")
        print("  mem_reservation: 512m  # 512MB минимум")
        print("  cpus: '1.5'         # 1.5 CPU ядра")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

