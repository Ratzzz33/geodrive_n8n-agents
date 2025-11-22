#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import io
import time
sys.path.append('setup')
from server_ssh import ServerSSH

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    ssh = ServerSSH()
    
    try:
        print("[*] Подключение к серверу...")
        ssh.connect()
        
        print("\n[*] Ожидание следующего запуска workflow (2 минуты)...")
        print("[*] Проверяем логи каждые 30 секунд...\n")
        
        for i in range(6):  # 6 попыток по 30 секунд = 3 минуты
            print(f"\n{'='*60}")
            print(f"[*] Попытка {i + 1}/6...")
            print('='*60)
            
            # Проверяем логи jarvis-api на наличие Maserati
            output, _, _ = ssh.execute("pm2 logs jarvis-api --lines 100 --nostream | grep -A 10 'MASERATI STATUS DEBUG'")
            
            if output and 'MASERATI' in output:
                print("\n[+++] НАШЛИ ЛОГИ MASERATI!\n")
                print(output)
                print("\n[+++] Проверка завершена!")
                return
            else:
                print("[...] Maserati логи ещё не появились")
                
                if i < 5:
                    print(f"[...] Ожидание 30 секунд...")
                    time.sleep(30)
        
        print("\n[!] Логи не найдены за 3 минуты")
        print("[*] Попробуйте запустить скрипт ещё раз через минуту")
        
    except Exception as e:
        print(f"[!] Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == '__main__':
    main()

