#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Быстрый просмотр прогресса парсинга (один раз)
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
        
        # Проверяем сессию
        check_cmd = f"screen -list | grep -q '{SCREEN_SESSION}' && echo 'exists' || echo 'not_exists'"
        output, error, exit_code = ssh.execute(check_cmd)
        
        if 'not_exists' in output:
            print("⚠️  Screen сессия не найдена!")
            print(f"💡 Запустите: python setup/run_parse_messages_screen.py --recreate")
            return
        
        # Получаем логи
        log_file = f"/tmp/parse_log_{SCREEN_SESSION}.txt"
        ssh.execute(f"screen -S {SCREEN_SESSION} -X hardcopy {log_file}")
        cmd = f"tail -{lines} {log_file} 2>/dev/null || echo 'Логи недоступны'"
        output, error, exit_code = ssh.execute(cmd)
        
        if output:
            print("=" * 70)
            print("📊 ПРОГРЕСС ПАРСИНГА")
            print("=" * 70)
            print()
            print(output)
            print()
            print("=" * 70)
            print(f"💡 Для обновления запустите снова или используйте:")
            print(f"   python setup/watch_parse_progress.py")
        else:
            print("⚠️  Логи пусты или сессия не найдена")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

