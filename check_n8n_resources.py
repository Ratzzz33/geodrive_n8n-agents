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
        
        # Ресурсы сервера
        print("\n[*] Ресурсы сервера Hetzner:")
        print("=" * 60)
        output, _, _ = ssh.execute("lscpu | grep -E 'CPU\\(s\\)|Model name'")
        print(output)
        output, _, _ = ssh.execute("free -h")
        print(output)
        
        # Ресурсы контейнера n8n
        print("\n[*] Текущее использование ресурсов n8n:")
        print("=" * 60)
        output, _, _ = ssh.execute("docker stats n8n --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}'")
        print(output)
        
        # Лимиты контейнера
        print("\n[*] Лимиты ресурсов контейнера n8n:")
        print("=" * 60)
        output, _, _ = ssh.execute("docker inspect n8n --format='CPU Shares: {{.HostConfig.CpuShares}}\nCPU Quota: {{.HostConfig.CpuQuota}}\nCPU Period: {{.HostConfig.CpuPeriod}}\nMemory: {{.HostConfig.Memory}}\nMemory Reservation: {{.HostConfig.MemoryReservation}}\nMemory Swap: {{.HostConfig.MemorySwap}}'")
        print(output)
        
        # docker-compose.yml конфигурация
        print("\n[*] Конфигурация в docker-compose.yml:")
        print("=" * 60)
        output, _, _ = ssh.execute("grep -A 20 'n8n:' /root/geodrive_n8n-agents/docker-compose.yml | grep -E 'cpus|mem_limit|mem_reservation'")
        if output:
            print(output)
        else:
            print("Лимиты не установлены (использует ресурсы по умолчанию)")
        
        # Использование всех контейнеров
        print("\n[*] Использование ресурсов всеми контейнерами:")
        print("=" * 60)
        output, _, _ = ssh.execute("docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'")
        print(output)
        
        # Нагрузка системы
        print("\n[*] Общая нагрузка системы:")
        print("=" * 60)
        output, _, _ = ssh.execute("uptime")
        print(output)
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

