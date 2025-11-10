#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Просмотр прогресса парсинга в реальном времени
"""

import sys
import os
import time

# Исправление кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from setup.server_ssh import ServerSSH

SCREEN_SESSION = "umnico_parse"

def clear_screen():
    """Очистка экрана"""
    if sys.platform == 'win32':
        os.system('cls')
    else:
        os.system('clear')

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Просмотр прогресса парсинга в реальном времени')
    parser.add_argument('--interval', type=int, default=3, help='Интервал обновления в секундах (по умолчанию: 3)')
    parser.add_argument('--lines', type=int, default=30, help='Количество строк для отображения (по умолчанию: 30)')
    parser.add_argument('--once', action='store_true', help='Показать один раз и выйти')
    args = parser.parse_args()
    
    ssh = ServerSSH()
    
    try:
        ssh.connect()
        print("✅ Подключение к серверу установлено\n")
        
        if args.once:
            # Показать один раз
            log_file = f"/tmp/parse_log_{SCREEN_SESSION}.txt"
            ssh.execute(f"screen -S {SCREEN_SESSION} -X hardcopy {log_file}")
            cmd = f"tail -{args.lines} {log_file} 2>/dev/null || echo 'Логи недоступны'"
            output, error, exit_code = ssh.execute(cmd)
            if output:
                print(output)
            else:
                print("⚠️  Логи пусты или сессия не найдена")
        else:
            # Режим реального времени
            print(f"📺 Просмотр прогресса парсинга (обновление каждые {args.interval} сек)")
            print("   Нажмите Ctrl+C для выхода\n")
            
            try:
                while True:
                    clear_screen()
                    print("=" * 70)
                    print(f"📊 ПРОГРЕСС ПАРСИНГА | Обновлено: {time.strftime('%H:%M:%S')}")
                    print("=" * 70)
                    print()
                    
                    # Проверяем, что сессия существует
                    check_cmd = f"screen -list | grep -q '{SCREEN_SESSION}' && echo 'exists' || echo 'not_exists'"
                    output, error, exit_code = ssh.execute(check_cmd)
                    
                    if 'not_exists' in output:
                        print("⚠️  Screen сессия не найдена!")
                        print(f"💡 Запустите: python setup/run_parse_messages_screen.py --recreate\n")
                        time.sleep(args.interval)
                        continue
                    
                    # Получаем логи
                    log_file = f"/tmp/parse_log_{SCREEN_SESSION}.txt"
                    ssh.execute(f"screen -S {SCREEN_SESSION} -X hardcopy {log_file}")
                    cmd = f"tail -{args.lines} {log_file} 2>/dev/null || echo 'Логи недоступны'"
                    output, error, exit_code = ssh.execute(cmd)
                    
                    if output and 'Логи недоступны' not in output:
                        print(output)
                    else:
                        print("⏳ Ожидание начала парсинга...")
                    
                    print()
                    print("=" * 70)
                    print(f"Следующее обновление через {args.interval} сек... (Ctrl+C для выхода)")
                    
                    time.sleep(args.interval)
                    
            except KeyboardInterrupt:
                print("\n\n⚠️  Просмотр прерван пользователем")
                
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()

if __name__ == "__main__":
    main()

