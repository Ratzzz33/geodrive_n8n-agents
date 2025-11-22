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
        
        # Детальная информация о CPU
        print("\n" + "="*60)
        print("[*] ИНФОРМАЦИЯ О CPU")
        print("="*60)
        output, _, _ = ssh.execute("lscpu | grep -E 'CPU\\(s\\)|Thread|Core|Socket|Model name|Architecture'")
        print(output)
        
        # Количество ядер
        print("\n" + "="*60)
        print("[*] КОЛИЧЕСТВО ЯДЕР")
        print("="*60)
        output, _, _ = ssh.execute("nproc")
        cores = output.strip()
        print(f"Доступно ядер (nproc): {cores}")
        
        output, _, _ = ssh.execute("lscpu | grep '^CPU(s):' | awk '{print $2}'")
        cpu_count = output.strip()
        print(f"CPU(s) из lscpu: {cpu_count}")
        
        # /proc/cpuinfo
        output, _, _ = ssh.execute("grep -c ^processor /proc/cpuinfo")
        cpuinfo_count = output.strip()
        print(f"Процессоров в /proc/cpuinfo: {cpuinfo_count}")
        
        # Детали каждого ядра
        print("\n" + "="*60)
        print("[*] ДЕТАЛИ ЯДЕР")
        print("="*60)
        output, _, _ = ssh.execute("lscpu -e")
        print(output)
        
        # Проверка
        print("\n" + "="*60)
        print("[*] РЕЗУЛЬТАТ")
        print("="*60)
        if cores == "4" and cpu_count == "4":
            print("[+++] ОТЛИЧНО! Сервер имеет 4 ядра CPU!")
        elif cores == "2" and cpu_count == "2":
            print("[!!!] ВНИМАНИЕ! Всё ещё 2 ядра. Возможно нужен перезапуск?")
        else:
            print(f"[?] Обнаружено {cores} ядер")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

