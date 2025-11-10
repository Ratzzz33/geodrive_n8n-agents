#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Получение логов из screen сессии парсинга
"""

import sys
import os

# Исправление кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from setup.server_ssh import ServerSSH

SCREEN_SESSION = "umnico_parse"

def main():
    lines = 50
    if len(sys.argv) > 1:
        try:
            lines = int(sys.argv[1])
        except:
            pass
    
    ssh = ServerSSH()
    
    try:
        ssh.connect()
        
        # Сохраняем логи из screen сессии
        log_file = f"/tmp/parse_log_{SCREEN_SESSION}.txt"
        ssh.execute(f"screen -S {SCREEN_SESSION} -X hardcopy {log_file}")
        
        # Получаем последние N строк
        cmd = f"tail -{lines} {log_file} 2>/dev/null || echo 'Логи недоступны'"
        output, error, exit_code = ssh.execute(cmd)
        
        if output:
            print(output)
        else:
            print("⚠️  Логи пусты или сессия не найдена")
            print(f"💡 Проверьте сессию: screen -ls")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

