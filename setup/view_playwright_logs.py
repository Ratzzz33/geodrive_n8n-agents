#!/usr/bin/env python3
"""
Скрипт для просмотра логов Playwright Service в реальном времени
"""

import sys
import subprocess
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from setup.server_ssh import ServerSSH

def main():
    print("Connecting to server to view Playwright Service logs...")
    print("   (Press Ctrl+C to exit)")
    print("")
    
    ssh = ServerSSH()
    try:
        ssh.connect()
        
        # Запускаем периодический опрос логов (journalctl -f не работает через paramiko)
        print("Starting log viewer (polling mode)...")
        print("=" * 60)
        print("Press Ctrl+C to exit")
        print("=" * 60)
        print()
        
        import time
        
        last_line_count = 0
        
        while True:
            try:
                # Получаем последние 50 строк логов
                output, _, _ = ssh.execute("journalctl -u playwright-amocrm -n 50 --no-pager")
                
                if output:
                    # Разбиваем на строки и показываем только новые
                    lines = output.split('\n')
                    new_lines = lines[last_line_count:]
                    
                    if new_lines:
                        # Фильтруем для Windows (убираем эмодзи и спецсимволы)
                        for line in new_lines:
                            if line.strip():
                                try:
                                    line_clean = line.encode('ascii', 'ignore').decode('ascii')
                                    print(line_clean)
                                except:
                                    print(line)
                        
                        last_line_count = len(lines)
                
                time.sleep(1)  # Обновляем каждую секунду
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(2)
        
    except KeyboardInterrupt:
        print("\n\nExiting log viewer")
    except Exception as e:
        print(f"ERROR: {e}")
        return 1
    finally:
        ssh.close()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

