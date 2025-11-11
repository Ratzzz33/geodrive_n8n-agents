#!/usr/bin/env python3
"""
Запуск парсинга AmoCRM на удаленном сервере
"""

import sys
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from setup.server_ssh import ServerSSH

PROJECT_DIR = "/root/geodrive_n8n-agents"

def main():
    print("Starting AmoCRM parsing on server...")
    
    ssh = ServerSSH()
    try:
        ssh.connect()
        
        # Обновляем код
        print("\n[1/4] Updating code...")
        ssh.execute(f"cd {PROJECT_DIR} && git pull || true")
        
        # Устанавливаем зависимости
        print("\n[2/4] Installing dependencies...")
        ssh.execute(f"cd {PROJECT_DIR} && npm install")
        
        # Запускаем парсинг
        print("\n[3/4] Starting parsing...")
        print("=" * 60)
        print("Parsing output (this may take a while):")
        print("=" * 60)
        
        # Запускаем парсинг с выводом в реальном времени
        # Используем execute_multiple для последовательного выполнения команд
        commands = [
            f"cd {PROJECT_DIR}",
            "export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002",
            "npm run parse:amocrm:all"
        ]
        
        # Выполняем команды и выводим результат
        output, error, exit_code = ssh.execute(" && ".join(commands))
        
        if output:
            # Фильтруем специальные символы для Windows
            try:
                output_clean = output.encode('ascii', 'ignore').decode('ascii')
                print(output_clean)
            except:
                print(output)
        if error:
            try:
                error_clean = error.encode('ascii', 'ignore').decode('ascii')
                print(f"STDERR: {error_clean}")
            except:
                print(f"STDERR: {error}")
        
        if exit_code != 0:
            print(f"\nERROR: Command exited with code {exit_code}")
            return 1
        
        print("\n[4/4] Parsing completed!")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n\nParsing interrupted by user")
        return 1
    except Exception as e:
        print(f"ERROR: {e}")
        return 1
    finally:
        ssh.close()

if __name__ == "__main__":
    sys.exit(main())

